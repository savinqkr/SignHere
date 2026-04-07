"use client";

import { use, useEffect, useState, useRef } from "react";
import { getSession, updateSessionSignature, isSessionExpired } from "@/lib/session";
import { downloadFile } from "@/lib/storage";
import { embedSignatureIntoPdf } from "@/lib/pdfUtils";
import { uploadSignedPdf } from "@/lib/storage";
import { Session } from "@/types/contract";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

const SignaturePad = dynamic(() => import("@/components/SignaturePad"), { ssr: false });

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default function SignPage({ params }: Props) {
  const { sessionId } = use(params);
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPad, setShowPad] = useState(false);
  const [signing, setSigning] = useState(false);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function loadSession() {
    try {
      const s = await getSession(sessionId);
      if (!s) {
        setError("세션을 찾을 수 없습니다.");
        return;
      }
      if (isSessionExpired(s)) {
        setError("링크가 만료되었습니다. (24시간 이후)");
        return;
      }
      if (s.status === "signed") {
        router.replace(`/complete/${sessionId}`);
        return;
      }
      setSession(s);
      await renderContract(s);
    } catch {
      setError("세션 불러오기 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function renderContract(s: Session) {
    if (s.file_type === "pdf") {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

      const ab = await downloadFile(s.file_url);
      const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
      const pages: string[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        // Use window width to pick appropriate scale
        const scale = Math.min(2, window.innerWidth / (page.getViewport({ scale: 1 }).width));
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        pages.push(canvas.toDataURL());

        if (i === 1) {
          setPageDimensions({ width: viewport.width, height: viewport.height });
        }
      }
      setPdfPages(pages);
    } else {
      const ab = await downloadFile(s.file_url);
      const mammoth = (await import("mammoth")).default;
      const result = await mammoth.convertToHtml({ arrayBuffer: ab });
      setDocxHtml(result.value);
    }
  }

  async function handleSignatureSave(dataUrl: string) {
    if (!session) return;
    setSigning(true);
    setShowPad(false);

    try {
      let signedFileUrl: string;

      if (session.file_type === "pdf") {
        const pdfArrayBuffer = await downloadFile(session.file_url);

        // Get the rendered page dimensions so we can scale correctly
        const renderW = pageDimensions.width;
        const renderH = pageDimensions.height;

        const signedBytes = await embedSignatureIntoPdf(
          pdfArrayBuffer,
          dataUrl,
          session.sign_position,
          renderW,
          renderH
        );

        const { uploadSignedPdf: upload } = await import("@/lib/storage");
        signedFileUrl = await upload(signedBytes as Uint8Array<ArrayBuffer>, session.id);
      } else {
        // For DOCX: convert to HTML, then generate a simple PDF with the signature
        // We create a basic PDF page with the signature using pdf-lib
        const { PDFDocument, rgb } = await import("pdf-lib");
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595, 842]); // A4

        // Add a note that the original is DOCX
        page.drawText("서명된 계약서 (원본: DOCX)", {
          x: 50,
          y: 800,
          size: 12,
        });

        // Embed signature
        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
        const sigBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
        const sigImg = await pdfDoc.embedPng(sigBytes);

        const sp = session.sign_position;
        const scaleX = 595 / (sp.width + sp.x + 50);
        page.drawImage(sigImg, {
          x: sp.x * scaleX,
          y: 842 - sp.y * scaleX - sp.height * scaleX,
          width: sp.width * scaleX,
          height: sp.height * scaleX,
        });

        const pdfBytes = await pdfDoc.save();
        signedFileUrl = await uploadSignedPdf(pdfBytes as Uint8Array<ArrayBuffer>, session.id);
      }

      await updateSessionSignature(session.id, dataUrl, signedFileUrl);
      router.push(`/complete/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "서명 저장 중 오류가 발생했습니다.");
    } finally {
      setSigning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500 text-sm animate-pulse">계약서 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="text-center">
          <p className="text-red-500 font-medium mb-2">오류가 발생했습니다</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Signature Pad overlay */}
      {showPad && (
        <SignaturePad
          onSave={handleSignatureSave}
          onClose={() => setShowPad(false)}
        />
      )}

      <div className="max-w-2xl mx-auto pb-24">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900">계약서 열람</h1>
            <p className="text-xs text-gray-400">{session?.file_name}</p>
          </div>
          {pdfPages.length > 1 && (
            <div className="flex items-center gap-1">
              {pdfPages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setCurrentPage(i + 1);
                    document.getElementById(`page-${i + 1}`)?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className={`w-7 h-7 rounded text-xs font-medium ${
                    currentPage === i + 1
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Document content */}
        <div ref={viewerRef} className="px-2 py-4">
          {session?.file_type === "pdf" && pdfPages.length > 0 ? (
            pdfPages.map((dataUrl, i) => (
              <div
                key={i}
                id={`page-${i + 1}`}
                className="mb-4 shadow-md rounded-lg overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={dataUrl}
                  alt={`페이지 ${i + 1}`}
                  className="w-full"
                  onLoad={() => {
                    if (i === 0 && viewerRef.current) {
                      const img = viewerRef.current.querySelector("img");
                      if (img) {
                        setPageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                      }
                    }
                  }}
                />
              </div>
            ))
          ) : docxHtml ? (
            <div
              className="bg-white rounded-xl shadow-sm p-5 prose max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: docxHtml }}
            />
          ) : null}
        </div>

        {/* Sticky sign button */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 z-20">
          <button
            onClick={() => setShowPad(true)}
            disabled={signing}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-base rounded-xl transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed shadow-lg"
          >
            {signing ? "서명 저장 중..." : "✍️  서명하기"}
          </button>
          <p className="text-center text-xs text-gray-400 mt-2">
            계약서를 충분히 읽은 후 서명하세요
          </p>
        </div>
      </div>
    </>
  );
}
