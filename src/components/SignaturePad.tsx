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
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    function resize() {
      if (!canvas || !padRef.current) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(ratio, ratio);
      padRef.current.clear();
      setIsEmpty(true);
    }

    padRef.current = new SignaturePadLib(canvas, {
      backgroundColor: "rgb(255, 255, 255)",
      penColor: "rgb(0, 0, 0)",
      minWidth: 1,
      maxWidth: 3,
    });

    padRef.current.addEventListener("endStroke", () => {
      setIsEmpty(padRef.current?.isEmpty() ?? true);
    });

    resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      padRef.current?.off();
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
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <button
          onClick={onClose}
          className="text-gray-500 text-sm font-medium px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-100"
        >
          취소
        </button>
        <h2 className="text-base font-semibold text-gray-800">서명하기</h2>
        <button
          onClick={handleClear}
          className="text-gray-500 text-sm font-medium px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-100"
        >
          다시쓰기
        </button>
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative bg-gray-50">
        <p className="absolute top-4 left-1/2 -translate-x-1/2 text-gray-300 text-sm select-none pointer-events-none">
          이 곳에 서명해 주세요
        </p>
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none"
          style={{ touchAction: "none" }}
        />
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-200 bg-white">
        <button
          onClick={handleSave}
          disabled={isEmpty}
          className={`w-full py-3 rounded-xl text-white font-semibold text-base transition-colors ${
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
