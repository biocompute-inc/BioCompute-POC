/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { RequireAuth } from "@/components/RequireAuth";
import { apiFetch } from "@/lib/api";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ConfirmDangerModal from "@/components/ConfirmDangerModal";
import { useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  FileCode,
  FileDown,
  FileText,
  Info,
  Loader2,
  Shredder,
  Trash,

} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE // keep consistent everywhere (cookies + CORS)

export default function JobDetailPage() {
  return (
    <RequireAuth>
      <JobDetailInner />
    </RequireAuth>
  );
}



function StatusPill({ status }: { status: string }) {
  const s = (status || "").toUpperCase();

  const base =
    "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1";

  if (s === "COMPLETED") {
    return (
      <span className={`${base} bg-green-50 text-green-700 ring-green-200`}>
        <CheckCircle2 className="h-4 w-4" />
        Retrived
      </span>
    );
  }
  if (s === "FAILED") {
    return (
      <span className={`${base} bg-red-50 text-red-700 ring-red-200`}>
        <Info className="h-4 w-4" />
        Failed
      </span>
    );
  }
  if (s === "DECODING" || s.includes("DECOD")) {
    return (
      <span className={`${base} bg-purple-50 text-purple-700 ring-purple-200`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Decoding
      </span>
    );
  }
  return (
    <span className={`${base} bg-gray-50 text-gray-700 ring-gray-200`}>
      <Info className="h-4 w-4" />
      {status || "Unknown"}
    </span>
  );
}

async function handleDownload(urlPath: string, fallbackName?: string) {
  const res = await fetch(`${API_BASE}${urlPath}`, {
    method: "GET",
    credentials: "include",
  });

  if (!res.ok) throw new Error(`Download failed (${res.status})`);

  const blob = await res.blob();

  const cd = res.headers.get("content-disposition") || "";
  const m = /filename\*=(?:UTF-8'')?([^;]+)|filename="?([^\";]+)"?/i.exec(cd);
  const fallback = (fallbackName || "").trim();
  const filename = decodeURIComponent((m?.[1] || m?.[2] || fallback).trim());

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

function JobDetailInner() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [redirecting, setRedirecting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const openDeleteBtnRef = useRef<HTMLButtonElement | null>(null);

  const canDownloadProtocol = useMemo(
    () => Boolean(job?.protocol_download_url),
    [job]
  );
  const canDownloadFile = useMemo(
    () => Boolean(job?.plaintext_path_download_url),
    [job]
  );
  const { user} = useAuth();

  const greetingName = useMemo(() => {
    return  user?.display_name || user?.email || "User";
  }, [ user]);
  const canDelete = useMemo(() => {
  const s = String(job?.status || "").trim().toLowerCase();
  if (s.includes("encoding") || s.includes("decoding") || s.includes("processing")) {
    return false;
  }
  return ["failed", "completed", "stored", "retrieved"].includes(s);
}, [job?.status]);


  useEffect(() => {
    let cancelled = false;

    (async () => {
      setErr(null);
      setMsg(null);
      try {
        const data = await apiFetch(`/jobs/${id}`);
        if (!cancelled) setJob(data);
      } catch (e: any) {
        if (!cancelled) setErr(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

async function deleteJobConfirmed() {
  if (!job?.id || deleting) return;

  setDeleting(true);
  setErr(null);
  setMsg(null);

  try {
    await apiFetch(`/jobs/${job.id}`, { method: "DELETE" });

    setMsg("Job deleted successfully. Redirecting to dashboard…");
    setRedirecting(true);

    // Soft delay so user sees confirmation
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 1200);

  } catch (e: any) {
    setErr(e.message);
  } finally {
    setDeleting(false);
    setShowDeleteConfirm(false);
    openDeleteBtnRef.current?.focus();
  }
}




  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading job…
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (err) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
            {err}
          </div>
          <div className="mt-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        {/* Top bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
                <div className="text-2xl font-extrabold text-neutral-700">Welcome, {greetingName}!</div>
              </h1>
              <StatusPill status={job?.status} />
              
            </div>
              <p className="py-3">Here You can see the detailed status of File {job?.original_filename}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <span className="rounded-lg bg-white px-3 py-1 shadow-sm">
                <span className="text-gray-400">ID:</span>{" "}
                <span className="font-mono text-gray-800">{job?.id}</span>
              </span>

              {job?.assigned_to && (
                <span className="rounded-lg bg-white px-3 py-1 shadow-sm">
                  <span className="text-gray-400">Assigned:</span>{" "}
                  <span className="font-medium text-gray-800">
                    {job?.assigned_to}
                  </span>
                </span>
              )}
            </div>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        </div>

        {/* Alerts */}
        {msg && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 shadow-sm">
            {msg}
          </div>
        )}

        {job?.error_message && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm whitespace-pre-wrap">
            {job.error_message}
          </div>
        )}

        {/* Content grid */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: Details */}
          <section className="lg:col-span-1">
            <div className="rounded-2xl bg-white p-6 pb-8 shadow-sm overflow-visible">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-gray-700" />
                <h2 className="text-lg font-bold text-gray-900">Job details</h2>
              </div>

              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-xs text-gray-500">Status</div>
                  <div className="mt-1 font-semibold text-gray-900">
                    {job?.status ?? "-"}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-xs text-gray-500">File Name</div>
                  <div className="mt-1 font-mono text-gray-900">
                    {job?.original_filename ?? "-"}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-xs text-gray-500">Scientist Assigned</div>
                  <div className="mt-1 font-mono text-gray-900">
                    {job?.assigned_to ?? "-"}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-xs text-gray-500">Job ID</div>
                  <div className="mt-1 font-mono text-gray-900">
                    {job?.id ?? "-"}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-xs text-gray-500">File ID</div>
                  <div className="mt-1 font-mono text-gray-900">
                    {job?.file_id ?? "-"}
                  </div>
                </div>
              </div>

              {/* Downloads */}
              <div className="mt-5 space-y-3">
                {canDownloadProtocol ? (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setErr(null);
                        setMsg(null);
                        await handleDownload(
                          job.protocol_download_url,
                          `protocol_${job?.id ?? "job"}.py`
                        );
                        setMsg("Protocol downloaded.");
                      } catch (e: any) {
                        setErr(e.message);
                      }
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
                  >
                    <FileCode className="h-4 w-4" />
                    Download protocol
                  </button>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">
                    No protocol attached.
                  </div>
                )}

                {canDownloadFile ? (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setErr(null);
                        setMsg(null);
                        await handleDownload(
                          job.plaintext_path_download_url,
                          job.original_filename
                        );
                        setMsg("File downloaded.");
                      } catch (e: any) {
                        setErr(e.message);
                      }
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
                  >
                    <FileDown className="h-4 w-4" />
                    Download file
                  </button>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">
                    No file found.
                  </div>
                )}
                {canDelete ? (
                    <button
                      ref={openDeleteBtnRef}
                      type="button"
                      onClick={() => {
                        setErr(null);
                        setShowDeleteConfirm(true);
                      }}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600! px-4 py-2.5 text-sm font-semibold text-white! hover:bg-red-700 cursor-pointer select-none appearance-none border-0 focus:outline-none focus:ring-2 focus:ring-red-300"
                    >
                      <Shredder className="h-4 w-4" />
                      Delete job
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-200! px-4 py-2.5 text-sm font-semibold text-gray-500! cursor-not-allowed select-none appearance-none border-0"
                      title={`Job is currently "${job?.status}". You can delete only after it finishes.`}
                    >
                      <Trash className="h-4 w-4" />
                      Delete job
                    </button>
                    
                  )}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-600 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <Info className="h-4 w-4 text-gray-500" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Tip</div>
                  <div className="mt-1">
                    If a download doesn’t start, make sure you’re logged in and
                    allow popups/downloads for this site.
                  </div>
                </div>
              </div>
            </div>

            {/* Inline errors (same style as lab upload card) */}
            {err && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm whitespace-pre-wrap">
                {err}
              </div>
            )}
          </section>

          {/* Right: Timeline */}
          <section className="lg:col-span-2">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-gray-700" />
                <h2 className="text-lg font-bold text-gray-900">Timeline</h2>
              </div>

              <div className="mt-4">
                {job?.events?.length ? (
                  <ol className="relative border-l border-gray-200">
                    {job.events.map((e: any, i: number) => (
                      <li key={i} className="mb-6 ml-4">
                        <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-gray-400" />
                        <div className="text-xs text-gray-500">
                          {e.created_at}
                        </div>
                        <div className="font-medium text-gray-900">
                          {e.event_type}
                        </div>
                        <div className="text-sm text-gray-600">{e.message}</div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">
                    No events yet. Suspiciously quiet.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Footer back link (optional since top already has one) */}
        <div className="mt-8">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-gray-500 hover:underline"
          >
            ← Back to dashboard
          </Link>
        </div>
      </div>
      <ConfirmDangerModal
        open={showDeleteConfirm}
        title="Delete job"
        description={`You are about to permanently delete this job and its file.
        Job ID: ${job?.id}
        File: ${job?.original_filename || job?.file_id || "Your file"}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        loading={deleting}
        onCancel={() => {
          if (deleting) return;
          setShowDeleteConfirm(false);
          openDeleteBtnRef.current?.focus();
        }}
        onConfirm={deleteJobConfirmed}
      />
    </main>
  );
}
