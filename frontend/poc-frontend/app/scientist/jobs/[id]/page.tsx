/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { RequireRole } from "@/components/RequireAuth";
import Loading from "@/components/Loading";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch, getCsrfToken, parseError } from "@/lib/api";
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
  Terminal,
  Wrench,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE // keep consistent everywhere (cookies + CORS)

// ---------------------------------------------------------------------------
// Protocol registry – must stay in sync with backend PROTOCOL_CHOICES
// ---------------------------------------------------------------------------
const PROTOCOLS = [
  {
    key: "brick_mix_sa_ot2",
    label: "Brick Mix + SA OT-2",
    description: "Full Brick Mix + Self-Assembly OT-2 protocol (cross-platform default)",
  },
  {
    key: "asym_pcr",
    label: "ASYM PCR",
    description: "Asymmetric PCR static protocol — no file encoding",
  },
  {
    key: "bm_sa_builder",
    label: "BM SA Builder (Linux)",
    description: "Brick Mix + Self-Assembly builder — Linux compatible",
  },
  {
    key: "build_brick_mix",
    label: "Build Brick Mix",
    description: "Generates a brick-mix protocol from the input file stem",
  },
  {
    key: "sa_builder_07",
    label: "SA Builder 07",
    description: "Self-Assembly-only builder v0.7",
  },
] as const;

type ProtocolKey = (typeof PROTOCOLS)[number]["key"];

function timeAgo(isoUtc: string): string {
  const generated = new Date(isoUtc);
  const now = new Date();
  const diffMs = now.getTime() - generated.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  let relative: string;
  if (diffSec < 60) relative = `${diffSec}s ago`;
  else if (diffMin < 60) relative = `${diffMin}m ago`;
  else if (diffHr < 24) relative = `${diffHr}h ago`;
  else relative = `${diffDay}d ago`;

  const utcLabel = generated.toLocaleString("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }) + " UTC";

  return `${relative} · ${utcLabel}`;
}

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

function StatusPill({
  status,
  accuracyPercent,
}: {
  status: string;
  accuracyPercent?: number | null;
}) {
  const s = (status || "").toUpperCase();
  const hasAccuracy = typeof accuracyPercent === "number";
  const accuracyLabel = hasAccuracy ? `${accuracyPercent.toFixed(2)}% Accuracy` : null;

  const base =
    "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1";

  if (s === "COMPLETED") {
    return (
      <span className={`${base} bg-green-50 text-green-700 ring-green-200`}>
        <CheckCircle2 className="h-4 w-4" />
        {hasAccuracy ? `Retrived with ${accuracyLabel}` : "Retrived"}
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
  const [generating, setGenerating] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolKey>("brick_mix_sa_ot2");
  const [generatedProtocols, setGeneratedProtocols] = useState<Array<{ filename: string; size_bytes: number; generated_at: string }>>([]);
  const [selectedGeneratedProtocol, setSelectedGeneratedProtocol] = useState<string>("");
  const [resultData, setResultData] = useState<any>(null);
  const [showLog, setShowLog] = useState(false);
  const [logAlreadySeen, setLogAlreadySeen] = useState(false);

  const greetingName = useMemo(() => {
    return user?.display_name || user?.email || "User";
  }, [user]);

  const sessionKey = `b2a_log_viewed_${id}`;

  async function fetchB2aResult() {
    try {
      const data = await apiFetch(`/jobs/${id}/b2a-result`);
      if (data?.available) {
        setResultData(data);
        // Mark the log as seen so it disappears after a refresh
        sessionStorage.setItem(sessionKey, "1");
      }
    } catch {
      // non-critical — silently ignore
    }
  }

  useEffect(() => {
    let cancelled = false;
    // Check before the fetch so the log is hidden on reload
    setLogAlreadySeen(!!sessionStorage.getItem(sessionKey));

    (async () => {
      setErr(null);
      try {
        const [jobData, protocolData] = await Promise.all([
          apiFetch(`/jobs/${id}`),
          apiFetch(`/jobs/${id}/protocols`).catch(() => []),
        ]);
        if (!cancelled) {
          setJob(jobData);
          setGeneratedProtocols(protocolData);
          if (protocolData.length > 0) setSelectedGeneratedProtocol(protocolData[0].filename);
          if (jobData?.status === "COMPLETED") {
            fetchB2aResult();
          }
        }
      } catch (e: any) {
        if (!cancelled) setErr(parseError(e));
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

  async function fetchGeneratedProtocols() {
    try {
      const data = await apiFetch(`/jobs/${id}/protocols`);
      setGeneratedProtocols(data);
      if (data.length > 0) setSelectedGeneratedProtocol((prev) => prev || data[0].filename);
    } catch {
      // non-critical
    }
  }

  async function uploadBam() {
    if (!bam || uploading) return;

    setErr(null);
    setMsg(null);
    setUploading(true);

    const form = new FormData();
    form.append("bam", bam);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/jobs/${id}/bam`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": getCsrfToken() },
        body: form,
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      setMsg(`Completed: ${data.status}`);
      await refreshJob();
      if (data.status === "COMPLETED") {
        await fetchB2aResult();
      }
    } catch (e: any) {
      setErr(parseError(e));
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
      setErr(parseError(e));
    } finally {
      setCompleting(false);
    }
  }
  async function generateProtocol(protocolKey: ProtocolKey) {
    if (generating) return;
    setErr(null);
    setMsg(null);
    setPushMsg(null);
    setGenerating(true);
    setShowGenerateModal(false);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/jobs/${id}/generate-protocol`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": getCsrfToken() },
        body: JSON.stringify({ protocol_key: protocolKey }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setMsg(`Protocol generated: ${data.protocol_filename}`);
      await refreshJob();
      await fetchGeneratedProtocols();
    } catch (e: any) {
      setErr(parseError(e));
    } finally {
      setGenerating(false);
    }
  }

  async function pushToOT2(filename: string) {
    if (pushing) return;
    setErr(null);
    setMsg(null);
    setPushMsg(null);
    setPushing(true);
    setShowPushModal(false);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/jobs/${id}/push-to-ot2`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": getCsrfToken() },
        body: JSON.stringify({ protocol_filename: filename }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPushMsg(data?.message || `Protocol "${filename}" pushed to OT-2 (placeholder).`);
      await refreshJob();
    } catch (e: any) {
      setErr(parseError(e));
    } finally {
      setPushing(false);
    }
  }

  async function downloadProtocolByName(filename: string) {
    setShowDownloadModal(false);
    try {
      setErr(null);
      await handleDownload(`/jobs/${id}/protocol/${filename}`, filename);
      setMsg(`Protocol "${filename}" downloaded.`);
    } catch (e: any) {
      setErr(parseError(e));
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
              href="/scientist/inbox"
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
              <StatusPill status={job?.status} accuracyPercent={job?.accuracy_percent} />
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
            href="/scientist/inbox"
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

        {/* Show-once B2A result panel */}
        {resultData?.available && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              {resultData.match ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <Info className="h-5 w-5 text-red-500" />
              )}
              <h2 className="text-lg font-bold text-emerald-900">Decoding Result</h2>
              {!logAlreadySeen && (
                <span className="ml-auto rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  Pipeline log visible once — hidden after refresh
                </span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <div className="text-xs text-gray-500">Match</div>
                <div className={`mt-1 font-semibold ${resultData.match ? "text-emerald-700" : "text-red-600"}`}>
                  {resultData.match ? "✅ Match" : "❌ Mismatch"}
                </div>
              </div>
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <div className="text-xs text-gray-500">Accuracy</div>
                <div className="mt-1 font-semibold text-gray-900">
                  {typeof resultData.accuracy_percent === "number"
                    ? `${resultData.accuracy_percent.toFixed(2)}%`
                    : "—"}
                </div>
              </div>
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <div className="text-xs text-gray-500">Bytes matched</div>
                <div className="mt-1 font-semibold text-gray-900">
                  {resultData.matched_bytes ?? "—"} / {resultData.expected_len ?? "—"}
                </div>
              </div>
              {resultData.first_mismatch_index != null && (
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <div className="text-xs text-gray-500">First mismatch</div>
                  <div className="mt-1 font-semibold text-red-600">byte {resultData.first_mismatch_index}</div>
                </div>
              )}
            </div>

            {resultData.decoded_text && (
              <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
                <div className="text-xs font-medium text-gray-500 mb-1">Decoded text</div>
                <div className="font-mono text-lg font-bold text-gray-900 break-all">
                  {resultData.decoded_text}
                </div>
              </div>
            )}

            {resultData.stdout_log && !logAlreadySeen && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowLog((v) => !v)}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 hover:underline"
                >
                  <Terminal className="h-3.5 w-3.5" />
                  {showLog ? "Hide" : "Show"} pipeline log
                </button>
                {showLog && (
                  <pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-gray-900 p-4 text-xs text-green-300 whitespace-pre-wrap">
                    {resultData.stdout_log}
                  </pre>
                )}
              </div>
            )}
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

                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-xs text-gray-500">Accuracy</div>
                  <div className="mt-1 font-mono text-gray-900">
                    {typeof job?.accuracy_percent === "number"
                      ? `${job.accuracy_percent.toFixed(2)}%`
                      : "-"}
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {/* Generate Protocol – always shown when job has an input file */}
                {job?.plaintext_path_download_url && (
                  <button
                    type="button"
                    onClick={() => setShowGenerateModal(true)}
                    disabled={generating}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                    title="Choose a protocol script and generate the OT-2 protocol file"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating…
                      </>
                    ) : (
                      <>
                        <FileCode className="h-4 w-4" />
                        Generate Protocol
                      </>
                    )}
                  </button>
                )}

                {/* Download Protocol + Push to OT-2 – only shown once protocols exist */}
                {generatedProtocols.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowDownloadModal(true)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 ring-1 ring-gray-200 hover:bg-gray-50"
                    >
                      <FileCode className="h-4 w-4" />
                      Download Protocol
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowPushModal(true)}
                      disabled={pushing}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                      title="Push a generated protocol to the OT-2 robot"
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
                )}

                {!job?.plaintext_path_download_url && generatedProtocols.length === 0 && (
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
                        setErr(parseError(e));
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

      {/* ------------------------------------------------------------------ */}
      {/* 1. Generate Protocol modal – pick script type                       */}
      {/* ------------------------------------------------------------------ */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <FileCode className="h-5 w-5 text-gray-700" />
                <h2 className="text-base font-bold text-gray-900">Generate Protocol</h2>
              </div>
              <button onClick={() => setShowGenerateModal(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">✕</button>
            </div>
            <div className="space-y-2 px-6 py-4">
              {PROTOCOLS.map((p) => (
                <label
                  key={p.key}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${selectedProtocol === p.key
                    ? "border-gray-900 bg-gray-50 ring-1 ring-gray-900"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                >
                  <input type="radio" name="gen-protocol" value={p.key} checked={selectedProtocol === p.key} onChange={() => setSelectedProtocol(p.key)} className="mt-0.5 accent-gray-900" />
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{p.label}</div>
                    <div className="mt-0.5 text-xs text-gray-500">{p.description}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button onClick={() => setShowGenerateModal(false)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={() => generateProtocol(selectedProtocol)} className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800">
                <FileCode className="h-4 w-4" />
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 2. Download Protocol modal – pick from generated protocols          */}
      {/* ------------------------------------------------------------------ */}
      {showDownloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <FileCode className="h-5 w-5 text-gray-700" />
                <h2 className="text-base font-bold text-gray-900">Download Protocol</h2>
              </div>
              <button onClick={() => setShowDownloadModal(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">✕</button>
            </div>
            <p className="px-6 pt-4 text-xs text-gray-500">Select a generated protocol file to download.</p>
            <div className="space-y-2 px-6 py-4">
              {generatedProtocols.map((p) => (
                <label
                  key={p.filename}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${selectedGeneratedProtocol === p.filename
                    ? "border-gray-900 bg-gray-50 ring-1 ring-gray-900"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                >
                  <input type="radio" name="dl-protocol" value={p.filename} checked={selectedGeneratedProtocol === p.filename} onChange={() => setSelectedGeneratedProtocol(p.filename)} className="mt-0.5 accent-gray-900" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-gray-900">{p.filename}</div>
                    <div className="mt-0.5 text-xs text-gray-500">{(p.size_bytes / 1024).toFixed(1)} KB · {timeAgo(p.generated_at)}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button onClick={() => setShowDownloadModal(false)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={() => downloadProtocolByName(selectedGeneratedProtocol)} disabled={!selectedGeneratedProtocol} className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60">
                <FileCode className="h-4 w-4" />
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 3. Push to OT-2 modal – pick from generated protocols               */}
      {/* ------------------------------------------------------------------ */}
      {showPushModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-gray-700" />
                <h2 className="text-base font-bold text-gray-900">Push to OT-2</h2>
              </div>
              <button onClick={() => setShowPushModal(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">✕</button>
            </div>
            <p className="px-6 pt-4 text-xs text-gray-500">Select which generated protocol to push to the OT-2 robot.</p>
            <div className="space-y-2 px-6 py-4">
              {generatedProtocols.map((p) => (
                <label
                  key={p.filename}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${selectedGeneratedProtocol === p.filename
                    ? "border-gray-900 bg-gray-50 ring-1 ring-gray-900"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                >
                  <input type="radio" name="push-protocol" value={p.filename} checked={selectedGeneratedProtocol === p.filename} onChange={() => setSelectedGeneratedProtocol(p.filename)} className="mt-0.5 accent-gray-900" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-gray-900">{p.filename}</div>
                    <div className="mt-0.5 text-xs text-gray-500">{(p.size_bytes / 1024).toFixed(1)} KB · {timeAgo(p.generated_at)}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button onClick={() => setShowPushModal(false)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={() => pushToOT2(selectedGeneratedProtocol)} disabled={!selectedGeneratedProtocol} className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60">
                <Wrench className="h-4 w-4" />
                Push to OT-2
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

