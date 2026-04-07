"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { SignPosition, getFileCategory } from "@/types/contract";
import { uploadFile } from "@/lib/storage";
import { createSession } from "@/lib/session";
import AdminGuard from "@/components/AdminGuard";

const QRDisplay = dynamic(() => import("@/components/QRDisplay"), { ssr: false });

type Step = "upload" | "position" | "share";

function HomeContent() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileExt, setFileExt] = useState<string>("pdf");
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Multiple sign positions
  const [signPositions, setSignPositions] = useState<SignPosition[]>([]);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragRect, setDragRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const ext = selected.name.split(".").pop()?.toLowerCase() ?? "bin";
    setError(null);
    setFile(selected);
    setFileExt(ext);
    setPdfPages([]);
    setImageDataUrl(null);
    setSignPositions([]);

    const category = getFileCategory(ext);

    if (category === "pdf") {
      await renderPdfPreview(selected);
    } else if (category === "image") {
      setImageDataUrl(URL.createObjectURL(selected));
      setStep("position");
    } else {
      setStep("position");
    }
  }

  async function renderPdfPreview(pdfFile: File) {
    setLoading(true);
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pages: string[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
        pages.push(canvas.toDataURL());
      }

      setPdfPages(pages);
      setStep("position");
    } catch {
      setError("PDF 렌더링 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  /** Returns coords relative to the scrollable container content (not viewport) */
  function getRelativeCoords(clientX: number, clientY: number) {
    const el = canvasContainerRef.current;
    if (!el) return { x: 0, y: 0 };
    const bounds = el.getBoundingClientRect();
    return {
      x: clientX - bounds.left + el.scrollLeft,
      y: clientY - bounds.top  + el.scrollTop,
    };
  }

  function finishDrag(rect: typeof dragRect) {
    if (!rect || rect.width <= 20 || rect.height <= 10) return;
    const el = canvasContainerRef.current;
    const img = el?.querySelector("img");
    // renderWidth/Height = actual displayed size of the content
    const renderWidth  = img?.clientWidth  ?? el?.clientWidth  ?? 1;
    const renderHeight = img?.scrollHeight ?? el?.scrollHeight ?? 1;
    const newPos: SignPosition = {
      id: crypto.randomUUID(),
      page: currentPage,
      ...rect,
      renderWidth,
      renderHeight,
    };
    setSignPositions((prev) => [...prev, newPos]);
  }

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    const { x, y } = getRelativeCoords(e.clientX, e.clientY);
    setDragStart({ x, y });
    setDragRect({ x, y, width: 0, height: 0 });
    setIsDragging(true);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging || !dragStart) return;
    const { x, y } = getRelativeCoords(e.clientX, e.clientY);
    setDragRect({
      x: Math.min(x, dragStart.x),
      y: Math.min(y, dragStart.y),
      width:  Math.abs(x - dragStart.x),
      height: Math.abs(y - dragStart.y),
    });
  }

  function handleMouseUp() {
    if (!isDragging) return;
    setIsDragging(false);
    finishDrag(dragRect);
    setDragStart(null);
    setDragRect(null);
  }

  function handleTouchStart(e: React.TouchEvent) {
    // Only one finger — ignore pinch
    if (e.touches.length > 1) return;
    e.preventDefault();
    const touch = e.touches[0];
    const { x, y } = getRelativeCoords(touch.clientX, touch.clientY);
    setDragStart({ x, y });
    setDragRect({ x, y, width: 0, height: 0 });
    setIsDragging(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!isDragging || !dragStart || e.touches.length > 1) return;
    const touch = e.touches[0];
    const { x, y } = getRelativeCoords(touch.clientX, touch.clientY);
    setDragRect({
      x: Math.min(x, dragStart.x),
      y: Math.min(y, dragStart.y),
      width:  Math.abs(x - dragStart.x),
      height: Math.abs(y - dragStart.y),
    });
  }

  function handleTouchEnd() {
    if (!isDragging) return;
    setIsDragging(false);
    finishDrag(dragRect);
    setDragStart(null);
    setDragRect(null);
  }

  function removePosition(id: string) {
    setSignPositions((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleGenerateLink() {
    if (!file || signPositions.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const tempId = crypto.randomUUID();
      const fileUrl = await uploadFile(file, tempId);
      const session = await createSession({
        file_url: fileUrl,
        file_name: file.name,
        file_type: fileExt,
        sign_positions: signPositions,
      });
      setSessionId(session.id);
      setStep("share");
    } catch (err) {
      setError(err instanceof Error ? err.message : "링크 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const signUrl = sessionId ? `${baseUrl}/sign/${sessionId}` : "";
  const category = getFileCategory(fileExt);

  // Positions on the currently viewed page
  const currentPagePositions = signPositions.filter((p) => p.page === currentPage);

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SignHere</h1>
          <p className="text-sm text-gray-500 mt-0.5">계약서 전자서명 서비스</p>
        </div>
        <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-xl px-3 py-1.5 hover:bg-gray-50">
          계약서 관리 →
        </a>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {(["upload", "position", "share"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
              step === s ? "bg-blue-600 text-white"
              : i < ["upload","position","share"].indexOf(step) ? "bg-green-500 text-white"
              : "bg-gray-200 text-gray-500"
            }`}>
              {i < ["upload","position","share"].indexOf(step) ? "✓" : i + 1}
            </div>
            {i < 2 && <div className="w-8 h-0.5 bg-gray-200" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
      )}

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">1. 파일 업로드</h2>
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDrop={(e) => {
              e.preventDefault();
              const dropped = e.dataTransfer.files[0];
              if (dropped) {
                const input = fileInputRef.current!;
                const dt = new DataTransfer();
                dt.items.add(dropped);
                input.files = dt.files;
                handleFileChange({ target: input } as React.ChangeEvent<HTMLInputElement>);
              }
            }}
            onDragOver={(e) => e.preventDefault()}
          >
            <div className="text-4xl mb-3">📂</div>
            <p className="text-gray-600 font-medium">파일을 드래그하거나 클릭하여 선택</p>
            <p className="text-xs text-gray-400 mt-1">모든 파일 형식 지원 (PDF, DOCX, 이미지 등)</p>
          </div>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
          {loading && <div className="mt-4 text-center text-sm text-gray-500 animate-pulse">미리보기 렌더링 중...</div>}
        </div>
      )}

      {/* Step 2: Position */}
      {step === "position" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">2. 서명 위치 지정</h2>
          <p className="text-sm text-gray-500 mb-1">드래그해서 서명 영역을 지정하세요. 여러 곳 지정 가능합니다.</p>

          {/* Page tabs (PDF only) */}
          {category === "pdf" && pdfPages.length > 1 && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-500">페이지:</span>
              {pdfPages.map((_, i) => (
                <button key={i} onClick={() => setCurrentPage(i + 1)}
                  className={`w-7 h-7 rounded text-xs font-medium transition-colors ${currentPage === i + 1 ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}

          {/* Drag area */}
          <div
            ref={canvasContainerRef}
            className="relative overflow-auto border border-gray-200 rounded-xl cursor-crosshair"
            style={{ maxHeight: "60vh" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {category === "pdf" && pdfPages[currentPage - 1] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pdfPages[currentPage - 1]} alt={`페이지 ${currentPage}`} className="w-full select-none pointer-events-none" draggable={false} />
            )}
            {category === "image" && imageDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageDataUrl} alt="미리보기" className="w-full select-none pointer-events-none" draggable={false} />
            )}
            {(category === "docx" || category === "other") && (
              <div className="flex flex-col items-center justify-center h-64 gap-2 text-gray-400 select-none">
                <span className="text-4xl">{category === "docx" ? "📝" : "📄"}</span>
                <p className="text-sm text-gray-500">{file?.name}</p>
                <p className="text-xs">드래그해서 서명 위치를 지정하세요</p>
              </div>
            )}

            {/* Live drag rect */}
            {isDragging && dragRect && dragRect.width > 0 && (
              <div className="absolute border-2 border-dashed border-blue-400 bg-blue-50/40 rounded pointer-events-none"
                style={{ left: dragRect.x, top: dragRect.y, width: dragRect.width, height: dragRect.height }} />
            )}

            {/* Confirmed positions on current page */}
            {currentPagePositions.map((pos, idx) => (
              <div key={pos.id}
                className="absolute border-2 border-blue-500 bg-blue-50/50 rounded group"
                style={{ left: pos.x, top: pos.y, width: pos.width, height: pos.height }}
              >
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-blue-600 font-medium bg-white/90 px-1.5 py-0.5 rounded whitespace-nowrap">
                  ✍️ {signPositions.indexOf(pos) + 1}
                </span>
                {/* Delete button */}
                <button
                  onMouseDown={(e) => { e.stopPropagation(); removePosition(pos.id); }}
                  onTouchStart={(e) => { e.stopPropagation(); removePosition(pos.id); }}
                  className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 leading-none z-10"
                  title="삭제"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Position list */}
          {signPositions.length > 0 && (
            <div className="mt-3 space-y-1">
              {signPositions.map((pos, idx) => (
                <div key={pos.id} className="flex items-center justify-between px-3 py-1.5 bg-blue-50 rounded-lg text-xs text-blue-700">
                  <span>영역 {idx + 1} — {category === "pdf" ? `${pos.page}페이지` : "문서"}</span>
                  <button onClick={() => removePosition(pos.id)} className="text-red-400 hover:text-red-600 font-medium">
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 mt-5">
            <button onClick={() => setStep("upload")} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50">
              이전
            </button>
            <button
              onClick={handleGenerateLink}
              disabled={signPositions.length === 0 || loading}
              className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors ${signPositions.length === 0 || loading ? "bg-gray-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
            >
              {loading ? "생성 중..." : `링크 생성 (영역 ${signPositions.length}개)`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Share */}
      {step === "share" && sessionId && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">3. 서명 링크 공유</h2>
          <p className="text-sm text-gray-500 mb-6">계약 상대방에게 아래 QR코드 또는 링크를 전달하세요</p>
          <QRDisplay url={signUrl} sessionId={sessionId} />
          <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
            서명이 완료되면{" "}
            <a href={`/complete/${sessionId}`} className="font-semibold underline">완료 페이지</a>
            에서 서명된 PDF를 다운로드할 수 있습니다.
          </div>
          <SessionStatusPoller sessionId={sessionId} />
        </div>
      )}
    </main>
  );
}

export default function HomePage() {
  return (
    <AdminGuard>
      <HomeContent />
    </AdminGuard>
  );
}

function SessionStatusPoller({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<"pending" | "signed">("pending");

  const poll = useCallback(async () => {
    const { getSession } = await import("@/lib/session");
    const session = await getSession(sessionId);
    if (session?.status === "signed") setStatus("signed");
  }, [sessionId]);

  useEffect(() => {
    const interval = setInterval(poll, 10000);
    poll();
    return () => clearInterval(interval);
  }, [poll]);

  if (status === "signed") {
    return (
      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
        <span className="text-green-600 text-lg">✅</span>
        <div>
          <p className="text-sm font-semibold text-green-700">서명 완료!</p>
          <a href={`/complete/${sessionId}`} className="text-xs text-green-600 underline">서명된 PDF 다운로드</a>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-2">
      <span className="text-gray-400 text-sm animate-pulse">⏳</span>
      <p className="text-xs text-gray-500">서명 대기 중... (자동 갱신)</p>
    </div>
  );
}
