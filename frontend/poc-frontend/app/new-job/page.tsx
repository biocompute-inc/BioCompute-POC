/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { RequireAuth } from "@/components/RequireAuth";
import { useState } from "react";

export default function NewJobPage() {
  return (
    <RequireAuth>
      <NewJobInner />
    </RequireAuth>
  );
}

function NewJobInner() {
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!file || loading) return;

    setErr(null);
    setMsg(null);
    setLoading(true);

    const form = new FormData();
    form.append("upload", file);

    try {
      const res = await fetch("http://localhost:8000/jobs/from-file", {
        method: "POST",
        credentials: "include",
        body: form,
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      setMsg(`Created job: ${data.job_id}`);
      window.location.href = `/jobs/${data.job_id}`;
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-semibold tracking-tight mb-2">
        Create new job
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        Upload a file. We’ll turn it into work. Machines will do the rest.
      </p>

      {/* Upload Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <label
          htmlFor="file"
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-10 text-center hover:border-gray-400"
        >
          <input
            id="file"
            type="file"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />

          <div className="text-sm font-medium text-gray-700">
            {file ? file.name : "Click to upload or drag & drop"}
          </div>
          <div className="mt-1 text-xs text-gray-400">
            Any valid job input file
          </div>
        </label>

        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={submit}
            disabled={!file || loading}
            className="rounded-md bg-black px-5 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-gray-800"
          >
            {loading ? "Uploading…" : "Upload & Create Job"}
          </button>

          <a
            href="/dashboard"
            className="text-sm font-medium text-gray-500 hover:underline"
          >
            Back to dashboard
          </a>
        </div>

        {msg && (
          <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {msg}
          </div>
        )}

        {err && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 whitespace-pre-wrap">
            {err}
          </div>
        )}
      </div>
    </div>
  );
}
