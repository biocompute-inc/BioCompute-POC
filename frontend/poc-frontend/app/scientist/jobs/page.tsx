/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useAuth } from "@/components/AuthProvider";
import { RequireRole } from "@/components/RequireAuth";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ClipboardList, RefreshCw, Download, ExternalLink } from "lucide-react";

type ScientistJob = {
  id: string;
  status: string;
  created_at: string | null;
  file_id: string;
  protocol_download_url: string | null;
  match: boolean | null;
};

export default function ScientistJobsPage() {
  return (
    <RequireRole allowed={["scientist", "admin"]}>
      <ScientistJobsInner />
    </RequireRole>
  );
}

function Badge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const base =
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold";

  if (s.includes("complete") || s.includes("done") || s.includes("success")) {
    return <span className={`${base} bg-green-50 text-green-700`}>Completed</span>;
    }
  if (s.includes("fail") || s.includes("error")) {
    return <span className={`${base} bg-red-50 text-red-700`}>Failed</span>;
  }
  if (s.includes("queue") || s.includes("pending")) {
    return <span className={`${base} bg-yellow-50 text-yellow-700`}>Pending</span>;
  }
  if (s.includes("run") || s.includes("process") || s.includes("encoding") || s.includes("retriev")) {
    return <span className={`${base} bg-blue-50 text-blue-700`}>In Progress</span>;
  }

  return <span className={`${base} bg-gray-50 text-gray-700`}>{status}</span>;
}

function ResultPill({ match }: { match: boolean | null }) {
  if (match === null) return <span className="text-gray-400">-</span>;
  if (match) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
        ✅ Match
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
      ❌ Mismatch
    </span>
  );
}

function ScientistJobsInner() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<ScientistJob[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const greetingName = useMemo(() => {
    return user?.display_name || user?.email || "User";
  }, [user]);

  const load = async () => {
    setErr(null);
    setLoading(true);
    try {
      const data = await apiFetch("/scientist/jobs");
      setJobs(data);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setErr(null);
      setLoading(true);
      try {
        const data = await apiFetch("/scientist/jobs");
        if (!cancelled) setJobs(data);
      } catch (e: any) {
        if (!cancelled) setErr(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-purple-50">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pb-24">
        {/* Top header row */}
        <header className="flex items-center justify-between pt-8">
          <div className="flex items-center gap-3 rounded-2xl bg-white/60 px-5 py-3 shadow-sm backdrop-blur">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-100">
              <ClipboardList className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-purple-700">
                Hi {greetingName}!
              </div>
              <div className="text-sm text-gray-500">Scientist workspace</div>
            </div>
          </div>

          <Link
            href="/lab/inbox"
            className="inline-flex items-center gap-2 rounded-xl bg-white/60 px-4 py-2.5 text-purple-600 shadow-sm backdrop-blur hover:bg-white/80"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="font-medium">Back to Lab Inbox</span>
          </Link>
        </header>

        {/* Banner */}
        <section className="mt-8">
          <div className="relative overflow-hidden rounded-3xl bg-purple-500 px-6 sm:px-8 pt-8 pb-24">
            <div className="flex items-center gap-4">
              <div className="h-10 w-1.5 rounded-full bg-white/95" />
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                Your Assigned Jobs
              </h1>
            </div>

            <div className="mt-4 text-white/90">
              Track protocol downloads, statuses, and results in one place.
            </div>

            {/* Wavy bottom edge */}
            <svg
              className="absolute bottom-0 left-0 w-full"
              viewBox="0 0 1440 160"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M0,64 C240,140 480,140 720,92 C960,44 1200,44 1440,92 L1440,160 L0,160 Z"
                fill="#F3E8FF"
              />
            </svg>
          </div>

          {/* Controls card (overlap) */}
          <div className="-mt-16 relative z-10">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-gray-600">
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                      Loading jobs…
                    </span>
                  ) : (
                    <span>
                      Showing <span className="font-semibold">{jobs.length}</span>{" "}
                      job{jobs.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={load}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-purple-700"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
              </div>

              {err && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <pre className="whitespace-pre-wrap">{err}</pre>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Table */}
        <section className="mt-10">
          <div className="rounded-xl bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Job ID
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Created
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Protocol
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Result
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {jobs.map((j) => (
                    <tr
                      key={j.id}
                      className="border-b border-gray-100 last:border-b-0"
                    >
                      <td className="px-6 py-5 text-sm text-gray-800">
                        <div className="max-w-[260px] truncate font-mono">
                          {j.id}
                        </div>
                        <div className="mt-1 text-xs text-gray-400">
                          File:{" "}
                          <span className="font-mono">
                            {j.file_id?.slice(0, 10) ?? "-"}…
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-5 text-sm text-gray-700">
                        {j.created_at
                          ? new Date(j.created_at).toLocaleString()
                          : "-"}
                      </td>

                      <td className="px-6 py-5 text-sm">
                        <div className="flex flex-col gap-2">
                          <Badge status={j.status} />
                          <div className="text-xs text-gray-400">{j.status}</div>
                        </div>
                      </td>

                      <td className="px-6 py-5 text-sm">
                        {j.protocol_download_url ? (
                          <a
                            href={`http://localhost:8000${j.protocol_download_url}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 font-medium text-purple-600 hover:text-purple-700"
                          >
                            <Download className="h-4 w-4" />
                            Download
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      <td className="px-6 py-5 text-sm">
                        <ResultPill match={j.match} />
                      </td>

                      <td className="px-6 py-5 text-sm">
                        <Link
                          href={`/lab/jobs/${j.id}`}
                          className="inline-flex items-center gap-2 font-medium text-purple-600 hover:text-purple-700"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {jobs.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="px-6 py-6 text-sm text-gray-500">
                        No assigned jobs right now.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
