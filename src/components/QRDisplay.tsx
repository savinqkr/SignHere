"use client";

import { useEffect, useRef, useState } from "react";

interface QRDisplayProps {
  url: string;
  sessionId: string;
}

export default function QRDisplay({ url, sessionId }: QRDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function generateQR() {
      if (!canvasRef.current) return;
      const QRCode = (await import("qrcode")).default;
      await QRCode.toCanvas(canvasRef.current, url, {
        width: 240,
        margin: 2,
        color: { dark: "#1e293b", light: "#ffffff" },
      });
    }
    generateQR();
  }, [url]);

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="bg-white p-4 rounded-2xl shadow-md border border-gray-100">
        <canvas ref={canvasRef} className="rounded" />
      </div>

      <p className="text-xs text-gray-400 text-center">
        QR코드를 스캔하거나 아래 링크를 공유하세요
      </p>

      <div className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 flex items-center gap-2">
        <span className="flex-1 text-xs text-gray-600 truncate">{url}</span>
        <button
          onClick={handleCopy}
          className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          {copied ? "복사됨!" : "복사"}
        </button>
      </div>

      <p className="text-xs text-gray-400">
        세션 ID: <span className="font-mono text-gray-600">{sessionId.slice(0, 8)}…</span>
      </p>
      <p className="text-xs text-red-400">링크는 24시간 후 만료됩니다</p>
    </div>
  );
}
