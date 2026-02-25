/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { RequireRole } from "@/components/RequireAuth";
import Loading from "@/components/Loading";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/api";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CloudUpload,
  FileCode,
  FileText,
  Info,
  Loader2,
  ShieldCheck,
  Wrench,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE // keep consistent everywhere (cookies + CORS)

async function handleDownload(urlPath: string, fallbackName?: string) {
  const res = await fetch(`${API_BASE}${urlPath}`, {
    method: "GET",
    credentials: "include",
  });

  if (!res.ok) throw new Error(`Download failed (${res.status})`);

  const blob = await res.blob();

  const cd = res.headers.get("content-disposition") || "";
  const m =
    /filename\*=(?:UTF-8'')?([^;]+)|filename="?([^\";]+)"?/i.exec(cd);
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

export default function LabJobPage() {
  return (
    <RequireRole allowed={["scientist", "admin"]}>
      <LabJobInner />
    </RequireRole>
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
        Retrived with 100% Accuracy
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
      {status}
    </span>
  );
}

function LabJobInner() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [job, setJob] = useState<any>(null);
  const [bam, setBam] = useState<File | null>(null);

  const [msg, setMsg] = useState<string | null>(null);
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [pushing, setPushing] = useState(false);

  const greetingName = useMemo(() => {
      return  user?.display_name || user?.email || "User";
  }, [ user]);

  useEffect(() => {
    let cancelled = false;


    (async () => {
      setErr(null);
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

  async function refreshJob() {
  const data = await apiFetch(`/jobs/${id}`);
  setJob(data);
}

  async function uploadBam() {
    if (!bam || uploading) return;

    setErr(null);
    setMsg(null);
    setUploading(true);

    const form = new FormData();
    form.append("bam", bam);

    try {
      const res = await fetch(`http://localhost:8000/jobs/${id}/bam`, {
        method: "POST",
        credentials: "include",
        body: form,
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      setMsg(`Completed: ${data.status}`);
      await refreshJob();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function markCompleted() {
    if (completing) return;
    setErr(null);
    setMsg(null);
    setCompleting(true);

    try {
      const data = await apiFetch(`/jobs/${id}/complete`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setJob((prev: any) => (prev ? { ...prev, status: data.status } : prev));
      setMsg("Job marked completed.");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setCompleting(false);
    }
  }
async function pushToOT2() {
  if (pushing) return;

  setErr(null);
  setMsg(null);
  setPushMsg(null);
  setPushing(true);

  try {
    const res = await fetch(`http://localhost:8000/jobs/${id}/push-to-ot2`, {
      method: "POST",
      credentials: "include",
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const data = await res.json();

    // show message
    setPushMsg(
      data?.message ||
        "Pushed to OT-2 (placeholder). When you add IP/key/command, this will run SSH."
    );

    // refresh job (status/events might have changed)
    await refreshJob();
  } catch (e: any) {
    setErr(e.message);
  } finally {
    setPushing(false);
  }
}

  const canMarkComplete = useMemo(() => {
    return (
      user?.role === "scientist" &&
      job?.assigned_to === user.id &&
      job?.status !== "COMPLETED" &&
      job?.status !== "FAILED" &&
      job?.status !== "DECODING"
    );
  }, [user, job]);

  if (loading) {
    return <Loading />;
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
              href="/lab/inbox"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Lab inbox
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
            href="/lab/inbox"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Lab inbox
          </Link>
        </div>

        {/* Alerts */}
        {msg && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 shadow-sm">
            {msg}
          </div>
        )}
        {pushMsg && (
          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 shadow-sm">
            {pushMsg}
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
            <div className="rounded-2xl bg-white p-6 shadow-sm">
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

              <div className="mt-5 space-y-3">
                {job?.protocol_download_url ? (
                  <>
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

                    {/* Push to OT-2 */}
                    <button
                      type="button"
                      onClick={pushToOT2}
                      disabled={pushing}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                      title="Placeholder now; will use SSH when OT-2 IP and key are configured"
                    >
                      {pushing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Pushing…
                        </>
                      ) : (
                        <>
                          <Wrench className="h-4 w-4" />
                          Push to OT-2
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">
                    No protocol attached.
                  </div>
                )}
              </div>

              {/* <div className="mt-5">
                {job?.plaintext_path_download_url ? (
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
                    Download File
                  </button>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">
                    No File Found.
                  </div>
                )}
              </div> */}
            </div>

            {/* Optional action */}
            {canMarkComplete && (
              <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-gray-700" />
                  <h3 className="text-base font-bold text-gray-900">
                    Mark completed
                  </h3>
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  Use this if the lab work is done without a BAM upload.
                </p>

                <button
                  onClick={markCompleted}
                  disabled={completing}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {completing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Marking…
                    </>
                  ) : (
                    "Mark completed"
                  )}
                </button>
              </div>
            )}
          </section>

          {/* Right: Upload */}
          <section className="lg:col-span-2">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <CloudUpload className="h-5 w-5 text-gray-700" />
                    <h2 className="text-lg font-bold text-gray-900">
                      Upload BAM
                    </h2>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    Upload the BAM file to decode and complete this job.
                  </p>
                </div>

                <div className="hidden sm:block text-xs text-gray-500">
                  Expected: <span className="font-mono">.bam</span>
                </div>
              </div>

              {/* Dropzone */}
              <label
                htmlFor="bam"
                className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-slate-50 px-6 py-10 text-center transition hover:border-gray-300 hover:bg-white"
              >
                <input
                  id="bam"
                  type="file"
                  className="hidden"
                  accept=".bam"
                  onChange={(e) => setBam(e.target.files?.[0] || null)}
                />

                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-sm">
                  <CloudUpload className="h-6 w-6 text-gray-700" />
                </div>

                <div className="mt-3 text-sm font-semibold text-gray-900">
                  {bam ? bam.name : "Click to select BAM file"}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  We’ll upload and start decoding automatically.
                </div>
              </label>

              {/* Actions */}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  onClick={uploadBam}
                  disabled={!bam || uploading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <CloudUpload className="h-4 w-4" />
                      Upload & Decode
                    </>
                  )}
                </button>

                <Link
                  href="/scientist/jobs"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Dashboard
                </Link>
              </div>

              {/* Small helper */}
              <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-600">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <Info className="h-4 w-4 text-gray-500" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Tip</div>
                    <div className="mt-1">
                      If your BAM upload is large, keep the tab open until the
                      upload finishes.
                    </div>
                  </div>
                </div>
              </div>

              {/* Errors */}
              {err && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm whitespace-pre-wrap">
                  {err}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

