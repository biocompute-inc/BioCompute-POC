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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setErr(null);
      try {
        const data = await apiFetch(`/jobs/${id}`);
        if (!cancelled) setJob(data);
      } catch (e: any) {
        if (!cancelled) setErr(e.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (err) return <pre style={{ color: "crimson" }}>{err}</pre>;
  if (!job) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 900, margin: "24px auto", padding: 16 }}>
      <h1>Job {job.id}</h1>
      <div>Status: {job.status}</div>

      {job.protocol_download_url && (
        <p>
          Protocol:{" "}
          <a href={`http://localhost:8000${job.protocol_download_url}`} target="_blank">
            Download
          </a>
        </p>
      )}

      {job.error_message && <pre style={{ color: "crimson" }}>{job.error_message}</pre>}

      <h2>Timeline</h2>
      <ul>
        {job.events?.map((e: any, i: number) => (
          <li key={i}>
            {e.created_at} — <b>{e.event_type}</b> — {e.message}
          </li>
        ))}
      </ul>

      <a href="/dashboard">Back</a>
    </div>
  );
}
