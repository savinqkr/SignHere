"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { Session } from "@/types/contract";
import Link from "next/link";

export default function DashboardPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    setLoading(true);
    const { data } = await getSupabase()
      .from("sessions")
      .select("*")
      .order("created_at", { ascending: false });
    setSessions((data as Session[]) ?? []);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("이 계약서를 삭제하시겠습니까?")) return;
    setDeletingId(id);
    await getSupabase().from("sessions").delete().eq("id", id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setDeletingId(null);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  }

  function isExpired(session: Session) {
    return new Date() > new Date(session.expires_at);
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">계약서 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">등록된 계약서와 서명 현황을 확인하세요</p>
        </div>
        <Link
          href="/"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700"
        >
          + 새 계약서
        </Link>
      </div>

      {/* Stats */}
      {!loading && sessions.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "전체", value: sessions.length, color: "bg-gray-50 text-gray-700" },
            { label: "서명 대기", value: sessions.filter(s => s.status === "pending" && !isExpired(s)).length, color: "bg-amber-50 text-amber-700" },
            { label: "서명 완료", value: sessions.filter(s => s.status === "signed").length, color: "bg-green-50 text-green-700" },
          ].map(({ label, value, color }) => (
            <div key={label} className={`${color} rounded-xl p-4 text-center`}>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-20 text-gray-400 text-sm animate-pulse">불러오는 중...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">📄</p>
          <p className="text-gray-500 font-medium">등록된 계약서가 없습니다</p>
          <Link href="/" className="mt-4 inline-block text-sm text-blue-600 underline">
            첫 계약서 업로드하기
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">파일명</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">상태</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">등록일</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">만료일</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sessions.map((s) => {
                  const expired = isExpired(s);
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{s.file_type === "pdf" ? "📄" : "📝"}</span>
                          <span className="text-gray-800 font-medium truncate max-w-48">{s.file_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.status} expired={expired} />
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(s.created_at)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        <span className={expired ? "text-red-400" : ""}>
                          {formatDate(s.expires_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {s.status === "pending" && !expired && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`${baseUrl}/sign/${s.id}`);
                                alert("링크가 복사되었습니다!");
                              }}
                              className="text-xs text-blue-600 hover:underline px-2 py-1 rounded hover:bg-blue-50"
                            >
                              링크 복사
                            </button>
                          )}
                          {s.status === "signed" && s.signed_file_url && (
                            <a
                              href={s.signed_file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-green-600 hover:underline px-2 py-1 rounded hover:bg-green-50"
                            >
                              다운로드
                            </a>
                          )}
                          <button
                            onClick={() => handleDelete(s.id)}
                            disabled={deletingId === s.id}
                            className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50"
                          >
                            {deletingId === s.id ? "삭제 중..." : "삭제"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {sessions.map((s) => {
              const expired = isExpired(s);
              return (
                <div key={s.id} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span>{s.file_type === "pdf" ? "📄" : "📝"}</span>
                      <span className="font-medium text-gray-800 text-sm truncate">{s.file_name}</span>
                    </div>
                    <StatusBadge status={s.status} expired={expired} />
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    등록: {formatDate(s.created_at)} · 만료: {formatDate(s.expires_at)}
                  </p>
                  <div className="flex gap-2">
                    {s.status === "pending" && !expired && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${baseUrl}/sign/${s.id}`);
                          alert("링크가 복사되었습니다!");
                        }}
                        className="flex-1 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                      >
                        링크 복사
                      </button>
                    )}
                    {s.status === "signed" && s.signed_file_url && (
                      <a
                        href={s.signed_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-1.5 text-xs font-medium text-center text-green-600 border border-green-200 rounded-lg hover:bg-green-50"
                      >
                        다운로드
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(s.id)}
                      disabled={deletingId === s.id}
                      className="py-1.5 px-3 text-xs font-medium text-red-400 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 text-center">
        <button onClick={fetchSessions} className="text-xs text-gray-400 hover:text-gray-600">
          새로고침
        </button>
      </div>
    </main>
  );
}

function StatusBadge({ status, expired }: { status: string; expired: boolean }) {
  if (status === "signed") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
        ✅ 서명 완료
      </span>
    );
  }
  if (expired) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">
        ⏰ 만료됨
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
      ⏳ 대기 중
    </span>
  );
}
