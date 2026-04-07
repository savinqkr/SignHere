"use client";

import { useEffect, useRef, useState } from "react";

const SESSION_KEY = "signhere_admin_auth";
const PIN = process.env.NEXT_PUBLIC_ADMIN_PIN ?? "0000";
const MAX_ATTEMPTS = 5;

interface AdminGuardProps {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const [status, setStatus] = useState<"loading" | "locked" | "unlocked">("loading");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const auth = sessionStorage.getItem(SESSION_KEY);
    setStatus(auth === "1" ? "unlocked" : "locked");
  }, []);

  useEffect(() => {
    if (status === "locked") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [status]);

  function handlePinChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    setPin(digits);
    setError("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (attempts >= MAX_ATTEMPTS) return;

    if (pin === PIN) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setStatus("unlocked");
    } else {
      const next = attempts + 1;
      setAttempts(next);
      setPin("");
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      if (next >= MAX_ATTEMPTS) {
        setError(`시도 횟수를 초과했습니다. 브라우저를 닫고 다시 시도하세요.`);
      } else {
        setError(`PIN이 올바르지 않습니다. (${next}/${MAX_ATTEMPTS})`);
      }
      inputRef.current?.focus();
    }
  }

  if (status === "loading") return null;
  if (status === "unlocked") return <>{children}</>;

  const blocked = attempts >= MAX_ATTEMPTS;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-50 z-50">
      <div className={`bg-white rounded-2xl shadow-lg border border-gray-100 p-8 w-full max-w-sm mx-4 ${shaking ? "animate-shake" : ""}`}>
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🔒</div>
          <h1 className="text-xl font-bold text-gray-900">관리자 인증</h1>
          <p className="text-sm text-gray-500 mt-1">PIN을 입력하세요</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* PIN dots display */}
          <div className="flex justify-center gap-3 mb-6">
            {Array.from({ length: Math.max(pin.length || 4, 4) }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-colors ${
                  i < pin.length ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
            ))}
          </div>

          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pin}
            onChange={(e) => handlePinChange(e.target.value)}
            disabled={blocked}
            placeholder="PIN 입력"
            className="w-full text-center text-2xl tracking-widest border border-gray-200 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            autoComplete="off"
          />

          {error && (
            <p className="text-center text-sm text-red-500 mb-4">{error}</p>
          )}

          <button
            type="submit"
            disabled={pin.length === 0 || blocked}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            확인
          </button>
        </form>
      </div>

      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
}
