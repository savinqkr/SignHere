"use client";

import { use, useEffect, useState } from "react";
import { getSession } from "@/lib/session";
import { Session } from "@/types/contract";
import Link from "next/link";

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default function CompletePage({ params }: Props) {
  const { sessionId } = use(params);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

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
      setSession(s);
    } catch {
      setError("세션 정보를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    if (!session?.signed_file_url) return;
    setDownloading(true);
    try {
      const response = await fetch(session.signed_file_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `signed_${session.file_name.replace(/\.(pdf|docx)$/i, "")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("다운로드 중 오류가 발생했습니다.");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500 text-sm animate-pulse">불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="text-center">
          <p className="text-red-500 font-medium">{error}</p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm text-blue-600 underline">
            처음으로
          </Link>
        </div>
      </div>
    );
  }

  const isPending = session?.status === "pending";

  return (
    <main className="max-w-md mx-auto px-4 py-16 text-center">
      {isPending ? (
        <>
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">서명 대기 중</h1>
          <p className="text-sm text-gray-500 mb-6">
            아직 서명이 완료되지 않았습니다. 계약 상대방이 서명을 완료하면 다운로드가 가능합니다.
          </p>
          <button
            onClick={loadSession}
            className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200"
          >
            새로고침
          </button>
        </>
      ) : (
        <>
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">서명 완료!</h1>
          <p className="text-sm text-gray-500 mb-2">
            계약서에 서명이 성공적으로 삽입되었습니다.
          </p>
          {session?.file_name && (
            <p className="text-xs text-gray-400 mb-8">{session.file_name}</p>
          )}

          {session?.signature_images && session.signature_images.length > 0 && (
            <div className="mb-8 flex flex-col items-center gap-2">
              <p className="text-xs text-gray-400">서명 미리보기</p>
              <div className="flex flex-wrap justify-center gap-2">
                {session.signature_images.map((sig, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={sig} alt={`서명 ${i + 1}`}
                    className="max-w-36 border border-gray-200 rounded-lg shadow-sm bg-white" />
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={handleDownload}
              disabled={downloading || !session?.signed_file_url}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed shadow-md"
            >
              {downloading ? "다운로드 중..." : "📥 서명된 PDF 다운로드"}
            </button>

            {session?.signed_file_url && (
              <a
                href={session.signed_file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-xl text-sm hover:bg-gray-200 transition-colors block"
              >
                브라우저에서 열기
              </a>
            )}

            <Link
              href="/dashboard"
              className="w-full py-3 border border-gray-300 text-gray-600 font-medium rounded-xl text-sm hover:bg-gray-50 transition-colors block"
            >
              새 계약서 업로드
            </Link>
          </div>

          <p className="text-xs text-gray-400 mt-8">
            서명 완료 시각:{" "}
            {session?.created_at
              ? new Date(session.created_at).toLocaleString("ko-KR")
              : "-"}
          </p>
        </>
      )}
    </main>
  );
}
