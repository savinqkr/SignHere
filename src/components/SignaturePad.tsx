"use client";

import { useEffect, useRef, useState } from "react";
import SignaturePadLib from "signature_pad";

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}

export default function SignaturePad({ onSave, onClose }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Lock body scroll while pad is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function initPad() {
      if (!canvas) return;
      // Use getBoundingClientRect for accurate rendered dimensions
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;

      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(ratio, ratio);

      if (padRef.current) {
        padRef.current.off();
      }

      padRef.current = new SignaturePadLib(canvas, {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "rgb(10, 10, 10)",
        minWidth: 1.5,
        maxWidth: 4,
        velocityFilterWeight: 0.7,
      });

      padRef.current.addEventListener("endStroke", () => {
        setIsEmpty(padRef.current?.isEmpty() ?? true);
      });
    }

    // Wait one frame so the canvas has rendered dimensions
    const raf = requestAnimationFrame(initPad);

    function handleResize() {
      const data = padRef.current?.toData();
      initPad();
      // Restore existing strokes after resize
      if (data && data.length > 0 && padRef.current) {
        padRef.current.fromData(data);
        setIsEmpty(false);
      }
    }

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
      padRef.current?.off();
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  function handleClear() {
    padRef.current?.clear();
    setIsEmpty(true);
  }

  function handleSave() {
    if (!padRef.current || padRef.current.isEmpty()) return;
    const dataUrl = padRef.current.toDataURL("image/png");
    onSave(dataUrl);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" style={{ touchAction: "none" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
        <button
          onClick={onClose}
          className="text-gray-500 text-sm font-medium px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-100 active:bg-gray-200"
        >
          취소
        </button>
        <h2 className="text-base font-semibold text-gray-800">서명하기</h2>
        <button
          onClick={handleClear}
          className="text-gray-500 text-sm font-medium px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-100 active:bg-gray-200"
        >
          다시쓰기
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <p className="absolute top-4 left-1/2 -translate-x-1/2 text-gray-300 text-sm select-none pointer-events-none z-10 whitespace-nowrap">
          이 곳에 서명해 주세요
        </p>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ touchAction: "none", cursor: "crosshair" }}
        />
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-200 bg-white shrink-0">
        <button
          onClick={handleSave}
          disabled={isEmpty}
          className={`w-full py-3.5 rounded-xl text-white font-semibold text-base transition-colors ${
            isEmpty
              ? "bg-gray-300 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
          }`}
        >
          서명 완료
        </button>
      </div>
    </div>
  );
}
