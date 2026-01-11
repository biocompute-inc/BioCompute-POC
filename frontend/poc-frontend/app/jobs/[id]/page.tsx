/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { RequireAuth } from "@/components/RequireAuth";
import { apiFetch } from "@/lib/api";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function JobDetailPage() {
  return (
    <RequireAuth>
      <JobDetailInner />
    </RequireAuth>
  );
}

function JobDetailInner() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
          Job {job.id}
        </h1>
        <div className="mt-2 inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
          Status: {job.status}
        </div>
      </div>

      {/* Job Info */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-3">
          Job details
        </h2>

        {job.protocol_download_url ? (
          <a
            href={`http://localhost:8000${job.protocol_download_url}`}
            target="_blank"
            className="inline-flex items-center text-sm font-medium text-black hover:underline"
          >
            Download protocol →
          </a>
        ) : (
          <p className="text-sm text-gray-500">
            No protocol available.
          </p>
        )}

        {job.error_message && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 whitespace-pre-wrap">
            {job.error_message}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">
          Timeline
        </h2>

        {job.events?.length ? (
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
                <div className="text-sm text-gray-600">
                  {e.message}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-gray-500">
            No events yet. Suspiciously quiet.
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8">
        <a
          href="/dashboard"
          className="text-sm font-medium text-gray-500 hover:underline"
        >
          ← Back to dashboard
        </a>
      </div>
    </div>
  );
}
