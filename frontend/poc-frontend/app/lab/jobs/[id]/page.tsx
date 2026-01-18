/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { RequireRole } from "@/components/RequireAuth";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/api";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function LabJobPage() {
  return (
    <RequireRole allowed={["scientist", "admin"]}>
      <LabJobInner />
    </RequireRole>
  );
}

function LabJobInner() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [bam, setBam] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [completing, setCompleting] = useState(false);

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

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8 text-sm text-gray-500">
        Loading job…
      </div>
    );
  }

  if (err) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          Lab Job {job.id}
        </h1>
        <div className="mt-2 inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
          Status: {job.status}
        </div>
      </div>

      {/* Job info */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-3">
          Job details
        </h2>

        {job.protocol_download_url ? (
          <a
            href={`http://127.0.0.1:8000${job.protocol_download_url}`}
            target="_blank"
            className="inline-flex items-center text-sm font-medium text-black hover:underline"
          >
            Download protocol →
          </a>
        ) : (
          <p className="text-sm text-gray-500">
            No protocol attached.
          </p>
        )}
      </div>

      {/* Upload BAM */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-2">
          Upload BAM
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Upload the BAM file to decode and complete this job.
        </p>

        <label
          htmlFor="bam"
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-8 text-center hover:border-gray-400"
        >
          <input
            id="bam"
            type="file"
            className="hidden"
            onChange={(e) => setBam(e.target.files?.[0] || null)}
          />

          <div className="text-sm font-medium text-gray-700">
            {bam ? bam.name : "Click to upload BAM file"}
          </div>
          <div className="mt-1 text-xs text-gray-400">
            .bam format expected
          </div>
        </label>

        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={uploadBam}
            disabled={!bam || uploading}
            className="rounded-md bg-black px-5 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-gray-800"
          >
            {uploading ? "Uploading…" : "Upload & Decode"}
          </button>

          <a
            href="/lab/inbox"
            className="text-sm font-medium text-gray-500 hover:underline"
          >
            Back to inbox
          </a>
        </div>

        {user?.role === "scientist" &&
          job?.assigned_to === user.id &&
          job?.status !== "COMPLETED" &&
          job?.status !== "FAILED" &&
          job?.status !== "DECODING" && (
            <div className="mt-6 flex items-center gap-4">
              <button
                onClick={markCompleted}
                disabled={completing}
                className="rounded-md border border-gray-300 px-5 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                {completing ? "Marking..." : "Mark completed"}
              </button>
              <span className="text-xs text-gray-500">
                Use if the lab work is done without BAM upload.
              </span>
            </div>
          )}

        {msg && (
          <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {msg}
          </div>
        )}

        {job.error_message && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 whitespace-pre-wrap">
            {job.error_message}
          </div>
        )}
      </div>
    </div>
  );
}
