"use client";

import { use, useEffect, useState, useRef } from "react";
import { getSession, updateSessionSignatures, isSessionExpired } from "@/lib/session";
import { downloadFile, uploadSignedPdf } from "@/lib/storage";
import { embedSignaturesIntoPdf } from "@/lib/pdfUtils";
import { Session, SignPosition, getFileCategory } from "@/types/contract";
import dynamic from "next/dynamic";

const SignaturePad = dynamic(() => import("@/components/SignaturePad"), { ssr: false });

type Step = "view" | "sign" | "done";

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default function SignPage({ params }: Props) {
  const { sessionId } = use(params);

  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("view");
  const [signing, setSigning] = useState(false);

  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);

  // Multi-sign: track which position index we're currently signing
  const [currentSignIdx, setCurrentSignIdx] = useState(0);
  const [showPad, setShowPad] = useState(false);
  const [collectedSignatures, setCollectedSignatures] = useState<string[]>([]);

  const [signedFileUrl, setSignedFileUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function loadSession() {
    try {
      const s = await getSession(sessionId);
      if (!s) { setError("세션을 찾을 수 없습니다."); return; }
      if (isSessionExpired(s)) { setError("링크가 만료되었습니다. (24시간 이후)"); return; }
      setSession(s);
      if (s.status === "signed" && s.signed_file_url) {
        setSignedFileUrl(s.signed_file_url);
        setStep("done");
      }
      await renderContract(s);
    } catch {
      setError("세션 불러오기 중 오류가 발생했습니다.");
    } finally {
      setLoadingSession(false);
    }
  }

  async function renderContract(s: Session) {
    const category = getFileCategory(s.file_type);

    if (category === "pdf") {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

      const ab = await downloadFile(s.file_url);
      const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
      const pages: string[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const scale = Math.min(2, window.innerWidth / page.getViewport({ scale: 1 }).width);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
        pages.push(canvas.toDataURL());
      }
      setPdfPages(pages);
    } else if (category === "docx") {
      const ab = await downloadFile(s.file_url);
      const mammoth = (await import("mammoth")).default;
      const result = await mammoth.convertToHtml({ arrayBuffer: ab });
      setDocxHtml(result.value);
    }
    // image & other: rendered from file_url directly
  }

  // Called when user finishes one signature pad
  async function handleSignatureSave(dataUrl: string) {
    if (!session) return;
    const updated = [...collectedSignatures];
    updated[currentSignIdx] = dataUrl;
    setCollectedSignatures(updated);
    setShowPad(false);

    const totalPositions = session.sign_positions.length;
    const nextIdx = currentSignIdx + 1;

    if (nextIdx < totalPositions) {
      // Move to next sign area
      setCurrentSignIdx(nextIdx);
      setShowPad(true);
    } else {
      // All signatures collected — embed and upload
      await finalize(updated);
    }
  }

  async function finalize(signatures: string[]) {
    if (!session) return;
    setSigning(true);
    try {
      let url: string;
      const category = getFileCategory(session.file_type);

      if (category === "pdf") {
        const pdfAb = await downloadFile(session.file_url);
        const signed = await embedSignaturesIntoPdf(pdfAb, signatures, session.sign_positions);
        url = await uploadSignedPdf(signed as Uint8Array<ArrayBuffer>, session.id);
      } else if (category === "image") {
        const { PDFDocument } = await import("pdf-lib");
        const imgAb = await downloadFile(session.file_url);
        const pdfDoc = await PDFDocument.create();
        const imgType = session.file_type.toLowerCase();
        const embeddedImg = imgType === "png"
          ? await pdfDoc.embedPng(imgAb)
          : await pdfDoc.embedJpg(imgAb);
        const { width: iw, height: ih } = embeddedImg;
        const page = pdfDoc.addPage([iw, ih]);
        page.drawImage(embeddedImg, { x: 0, y: 0, width: iw, height: ih });
        for (let i = 0; i < session.sign_positions.length; i++) {
          const sp = session.sign_positions[i];
          const sig = signatures[i];
          if (!sig) continue;
          const b64 = sig.replace(/^data:image\/\w+;base64,/, "");
          const sigBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const sigImg = await pdfDoc.embedPng(sigBytes);
          const sx = iw / sp.renderWidth;
          const sy = ih / sp.renderHeight;
          page.drawImage(sigImg, {
            x: sp.x * sx,
            y: ih - sp.y * sy - sp.height * sy,
            width: sp.width * sx,
            height: sp.height * sy,
          });
        }
        const bytes = await pdfDoc.save();
        url = await uploadSignedPdf(bytes as Uint8Array<ArrayBuffer>, session.id);
      } else {
        const { PDFDocument } = await import("pdf-lib");
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595, 842]);
        page.drawText(`서명된 계약서 (원본: ${session.file_name})`, { x: 50, y: 800, size: 11 });
        for (let i = 0; i < session.sign_positions.length; i++) {
          const sp = session.sign_positions[i];
          const sig = signatures[i];
          if (!sig) continue;
          const b64 = sig.replace(/^data:image\/\w+;base64,/, "");
          const sigBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const sigImg = await pdfDoc.embedPng(sigBytes);
          const sx = 595 / sp.renderWidth;
          const sy = 842 / sp.renderHeight;
          page.drawImage(sigImg, {
            x: sp.x * sx,
            y: 842 - sp.y * sy - sp.height * sy,
            width: sp.width * sx,
            height: sp.height * sy,
          });
        }
        const bytes = await pdfDoc.save();
        url = await uploadSignedPdf(bytes as Uint8Array<ArrayBuffer>, session.id);
      }

      await updateSessionSignatures(session.id, signatures, url);
      setSignedFileUrl(url);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "서명 저장 중 오류가 발생했습니다.");
    } finally {
      setSigning(false);
    }
  }

  async function handleDownload() {
    if (!signedFileUrl || !session) return;
    setDownloading(true);
    try {
      const res = await fetch(signedFileUrl);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `signed_${session.file_name.replace(/\.(pdf|docx)$/i, "")}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setDownloading(false);
    }
  }

  function startSigning() {
    setCurrentSignIdx(0);
    setCollectedSignatures([]);
    setShowPad(true);
  }

  // ── Loading / Error ──────────────────────────────────────────────────────────
  if (loadingSession) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400 text-sm animate-pulse">계약서 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-6">
        <div className="text-center">
          <p className="text-2xl mb-3">⚠️</p>
          <p className="text-red-500 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  // ── Step: done ───────────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">서명 완료!</h1>
        <p className="text-sm text-gray-500 mb-8">서명이 계약서에 삽입되었습니다.</p>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="w-full max-w-xs py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {downloading ? "다운로드 중..." : "📥 서명된 PDF 다운로드"}
        </button>
        {signedFileUrl && (
          <a href={signedFileUrl} target="_blank" rel="noopener noreferrer"
            className="mt-3 w-full max-w-xs py-3 bg-gray-100 text-gray-700 font-medium rounded-xl text-sm text-center block hover:bg-gray-200">
            브라우저에서 열기
          </a>
        )}
      </div>
    );
  }

  const totalPositions = session?.sign_positions.length ?? 0;

  // ── Step: view / sign ────────────────────────────────────────────────────────
  return (
    <>
      {/* Signature Pad overlay — shown once per sign area */}
      {showPad && (
        <SignaturePad
          label={totalPositions > 1 ? `서명 ${currentSignIdx + 1} / ${totalPositions}` : undefined}
          onSave={handleSignatureSave}
          onClose={() => { setShowPad(false); setSigning(false); }}
        />
      )}

      <div className="max-w-2xl mx-auto pb-28">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100 px-4 py-3">
          <h1 className="text-base font-semibold text-gray-900">계약서 열람</h1>
          <p className="text-xs text-gray-400 truncate">{session?.file_name}</p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border-b border-blue-100 text-xs text-blue-700">
          <span className={step === "view" ? "font-bold" : "opacity-50"}>① 계약서 확인</span>
          <span className="opacity-40">→</span>
          <span className={step === "sign" ? "font-bold" : "opacity-50"}>
            ② 서명{totalPositions > 1 ? ` (${totalPositions}곳)` : ""}
          </span>
          <span className="opacity-40">→</span>
          <span className="opacity-50">③ 다운로드</span>
        </div>

        {/* Document */}
        <div ref={viewerRef} className="px-2 py-4">
          {(() => {
            const cat = session ? getFileCategory(session.file_type) : "other";
            if (cat === "pdf" && pdfPages.length > 0) {
              return pdfPages.map((src, i) => (
                <div key={i} className="mb-4 shadow-md rounded-lg overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`페이지 ${i + 1}`} className="w-full" />
                </div>
              ));
            }
            if (cat === "docx" && docxHtml) {
              return (
                <div className="bg-white rounded-xl shadow-sm p-5 prose max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: docxHtml }} />
              );
            }
            if (cat === "image" && session?.file_url) {
              return (
                <div className="shadow-md rounded-lg overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={session.file_url} alt="계약서" className="w-full" />
                </div>
              );
            }
            if (cat === "other" && session?.file_url) {
              return (
                <div className="bg-white rounded-xl shadow-sm p-6 text-center">
                  <p className="text-4xl mb-3">📄</p>
                  <p className="text-sm font-medium text-gray-700 mb-2">{session?.file_name}</p>
                  <p className="text-xs text-gray-400 mb-4">이 파일 형식은 브라우저에서 미리볼 수 없습니다.</p>
                  <a href={session.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline">
                    파일 열기 / 다운로드
                  </a>
                </div>
              );
            }
            return (
              <div className="flex items-center justify-center h-64">
                <p className="text-gray-400 text-sm animate-pulse">문서 렌더링 중...</p>
              </div>
            );
          })()}
        </div>

        {/* Bottom CTA */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 z-20">
          {step === "view" ? (
            <>
              <button onClick={() => setStep("sign")}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base rounded-xl shadow-lg">
                계약서를 모두 읽었습니다 →
              </button>
              <p className="text-center text-xs text-gray-400 mt-2">계약서를 끝까지 스크롤하여 내용을 확인하세요</p>
            </>
          ) : (
            <>
              <button
                onClick={startSigning}
                disabled={signing}
                className="w-full py-3.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold text-base rounded-xl shadow-lg disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {signing
                  ? "서명 저장 중..."
                  : totalPositions > 1
                  ? `✍️  서명하기 (${totalPositions}곳)`
                  : "✍️  서명하기"}
              </button>
              <button onClick={() => setStep("view")} className="w-full mt-2 py-2 text-sm text-gray-400 hover:text-gray-600">
                계약서 다시 보기
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
