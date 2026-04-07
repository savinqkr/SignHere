"use client";

import { useEffect, useRef, useState } from "react";

interface ContractViewerProps {
  fileUrl: string;
  fileType: "pdf" | "docx";
}

export default function ContractViewer({ fileUrl, fileType }: ContractViewerProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);

  useEffect(() => {
    if (fileType === "pdf") {
      renderPdf();
    } else {
      renderDocx();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl, fileType]);

  async function renderPdf() {
    try {
      setLoading(true);
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

      const response = await fetch(fileUrl);
      const arrayBuffer = await response.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setNumPages(pdf.numPages);

      if (!canvasRef.current) return;
      canvasRef.current.innerHTML = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = document.createElement("canvas");
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.className = "w-full shadow-md mb-4 rounded";

        const context = canvas.getContext("2d")!;
        await page.render({ canvasContext: context, viewport }).promise;

        canvasRef.current.appendChild(canvas);
      }
    } catch (err) {
      setError("PDF를 불러오는 중 오류가 발생했습니다.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function renderDocx() {
    try {
      setLoading(true);
      const response = await fetch(fileUrl);
      const arrayBuffer = await response.arrayBuffer();
      const mammoth = (await import("mammoth")).default;
      const result = await mammoth.convertToHtml({ arrayBuffer });
      setDocxHtml(result.value);
    } catch (err) {
      setError("문서를 불러오는 중 오류가 발생했습니다.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 text-sm animate-pulse">계약서 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500 text-sm">{error}</div>
      </div>
    );
  }

  if (fileType === "docx" && docxHtml) {
    return (
      <div
        className="prose max-w-none p-4 bg-white shadow rounded"
        dangerouslySetInnerHTML={{ __html: docxHtml }}
      />
    );
  }

  return (
    <div>
      {numPages > 0 && (
        <p className="text-xs text-gray-400 mb-2 text-center">총 {numPages}페이지</p>
      )}
      <div ref={canvasRef} className="overflow-x-auto" />
    </div>
  );
}
