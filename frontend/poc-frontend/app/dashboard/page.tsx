/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Database, Dna, Download, FileText, LogOut, Plus } from "lucide-react";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardInner />
    </RequireAuth>
  );
}

function StatusCell({
  status,
  progress = 45,
}: {
  status: string;
  progress?: number;
}) {
  const s = (status || "").toLowerCase();

  const isStored = s === "stored" || s === "complete" || s === "completed";
  const isEncoding = s.includes("encod");
  const isRetrieving = s.includes("retriev");

  if (isStored) {
    return <span className="text-gray-700">Stored</span>;
  }

  const label = isEncoding ? "Encoding..." : isRetrieving ? "Retrieving..." : `${status}...`;

  return (
    <div className="min-w-[170px]">
      <div className="text-gray-700">{label}</div>
      <div className="mt-2 h-1 w-full rounded bg-gray-200">
        <div
          className="h-1 rounded bg-purple-400"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      <div className="mt-2 text-xs text-gray-500">Estimated time: 24h</div>
    </div>
  );
}

function ActionCell({
  status,
  jobId,
  fileId,
}: {
  status: string;
  jobId?: string | null;
  fileId?: string | null;
}) {
  const s = (status || "").toLowerCase();
  const isStored = s === "stored" || s === "complete" || s === "completed";
  const isBusy = s.includes("encod") || s.includes("retriev") || s.includes("process");

  // Keep your existing "View" behavior if job_id exists, but also match your spec:
  // Stored => Retrieve, Busy => Cancel.
  // If you'd rather keep "View" always, tell me and I'll adjust.
  if (isStored) {
    return (
      <button
        type="button"
        className="font-medium text-purple-600 hover:text-purple-700"
        onClick={() => {
          // Hook up to your real retrieve endpoint / action if you have one
          // e.g., apiFetch(`/files/${fileId}/retrieve`, { method: "POST" })
          console.log("Retrieve", { fileId, jobId });
        }}
      >
        Retrieve
      </button>
    );
  }

  if (isBusy) {
    return (
      <button
        type="button"
        className="font-medium text-purple-400 hover:text-purple-500"
        onClick={() => {
          // Hook up to your real cancel endpoint / action if you have one
          console.log("Cancel", { fileId, jobId });
        }}
      >
        Cancel
      </button>
    );
  }

  // Fallback: if a job exists, keep your existing "View" link
  if (jobId) {
    return (
      <Link href={`/jobs/${jobId}`} className="font-medium text-purple-600 hover:text-purple-700">
        View
      </Link>
    );
  }

  return <span className="text-gray-400">-</span>;
}

function DashboardInner() {
  const { user, logout } = useAuth();

  const [summary, setSummary] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const greetingName = useMemo(() => {
    return user?.display_name || user?.email || "User";
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setErr(null);
      try {
        const s = await apiFetch("/dashboard/summary");
        const f = await apiFetch("/dashboard/files");
        if (!cancelled) {
          setSummary(s);
          setFiles(f);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-purple-50">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pb-24">
        {/* Header */}
        <header className="flex items-center justify-between pt-8">
          <div className="flex items-center gap-3 rounded-2xl bg-white/60 px-5 py-3 shadow-sm backdrop-blur">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-100">
              <Dna className="h-5 w-5 text-purple-600" />
            </div>
            <div className="text-2xl font-extrabold text-purple-700">
              Hi, {greetingName}!
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-xl bg-white/60 px-4 py-2.5 text-purple-600 shadow-sm backdrop-blur hover:bg-white/80"
          >
            <LogOut className="h-4 w-4" />
            <span className="font-medium">Log Out</span>
          </button>
        </header>

        {/* Error */}
        {err && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <pre className="whitespace-pre-wrap">{err}</pre>
          </div>
        )}

        {/* Overview Banner */}
        <section className="mt-8">
          <div className="relative overflow-hidden rounded-3xl bg-purple-500 px-6 sm:px-8 pt-8 pb-24">
            <div className="flex items-center gap-4">
              <div className="h-10 w-1.5 rounded-full bg-white/95" />
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                Your Overview
              </h1>
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

          {/* Stats Cards (overlap) */}
          <div className="-mt-16 relative z-10">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-3xl font-extrabold text-gray-900">
                      {summary?.total_files ?? "—"}
                    </div>
                    <div className="mt-1 text-sm text-gray-500">Total Files</div>
                  </div>
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-purple-100">
                    <FileText className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-3xl font-extrabold text-gray-900">
                      {summary ? formatBytes(summary.total_storage_bytes) : "—"}
                    </div>
                    <div className="mt-1 text-sm text-gray-500">Total Storage</div>
                  </div>
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-purple-100">
                    <Database className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-3xl font-extrabold text-gray-900">
                      {summary?.total_retrievals ?? "—"}
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      Total Retrievals
                    </div>
                  </div>
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-purple-100">
                    <Download className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Links (kept from your original, but styled) */}
        <section className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/new-job"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-purple-700 shadow-sm hover:bg-white/80"
          >
            <Plus className="h-4 w-4" />
            <span className="font-medium">Upload a File</span>
          </Link>

          {(user?.role === "scientist" || user?.role === "admin") && (
            <Link
              href="/lab/inbox"
              className="inline-flex items-center rounded-xl bg-white px-4 py-2.5 text-purple-700 shadow-sm hover:bg-white/80"
            >
              <span className="font-medium">Lab Inbox</span>
            </Link>
          )}
        </section>

        {/* Data Table */}
        <section className="mt-10">
          <h2 className="text-xl font-extrabold text-purple-700">Your Data</h2>

          <div className="mt-4 rounded-xl bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Sr. No.
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      File Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Date Uploaded
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Size
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {files.map((r, idx) => (
                    <tr
                      key={r.file_id ?? `${idx}`}
                      className="border-b border-gray-100 last:border-b-0"
                    >
                      <td className="px-6 py-5 text-sm text-gray-700">
                        {idx + 1}
                      </td>

                      <td className="px-6 py-5 text-sm text-gray-700">
                        <div className="w-64 truncate">{r.file_name}</div>
                      </td>

                      <td className="px-6 py-5 text-sm text-gray-700">
                        {r.uploaded_at
                          ? new Date(r.uploaded_at).toLocaleDateString()
                          : "-"}
                      </td>

                      <td className="px-6 py-5 text-sm text-gray-700">
                        {typeof r.size_bytes === "number"
                          ? formatBytes(r.size_bytes)
                          : "-"}
                      </td>

                      <td className="px-6 py-5 text-sm">
                        <StatusCell status={r.status} progress={r.progress_pct ?? 45} />
                      </td>

                      <td className="px-6 py-5 text-sm">
                        <ActionCell
                          status={r.status}
                          jobId={r.job_id}
                          fileId={r.file_id}
                        />
                      </td>
                    </tr>
                  ))}

                  {files.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-6 text-sm text-gray-500">
                        No files yet. Upload one to create your first job.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {/* FAB */}
      <Link
        href="/new-job"
        className="fixed bottom-6 right-6 inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-5 py-3 text-white shadow-lg hover:bg-purple-700"
        aria-label="Upload a File"
      >
        <Plus className="h-5 w-5" />
        <span className="font-semibold">Upload a File</span>
      </Link>
    </main>
  );
}
