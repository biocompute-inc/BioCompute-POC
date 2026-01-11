/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { RequireRole } from "@/components/RequireAuth";
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
  const [job, setJob] = useState<any>(null);
  const [bam, setBam] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
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

  async function uploadBam() {
    if (!bam) return;
    setErr(null);
    setMsg(null);

    const form = new FormData();
    form.append("bam", bam);

    const res = await fetch(`http://localhost:8000/jobs/${id}/bam`, {
      method: "POST",
      credentials: "include",
      body: form,
    });

    if (!res.ok) {
      setErr(await res.text());
      return;
    }

    const data = await res.json();
    setMsg(`Completed: ${data.status}`);
  }

  if (err) return <pre style={{ color: "crimson" }}>{err}</pre>;
  if (!job) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 900, margin: "24px auto", padding: 16 }}>
      <h1>Lab Job {job.id}</h1>
      <div>Status: {job.status}</div>

      {job.protocol_download_url && (
        <p>
          Protocol:{" "}
          <a href={`http://127.0.0.1:8000${job.protocol_download_url}`} target="_blank">
            Download
          </a>
        </p>
      )}

      <h2>Upload BAM</h2>
      <input type="file" onChange={(e) => setBam(e.target.files?.[0] || null)} />
      <button onClick={uploadBam} disabled={!bam}>
        Upload & Decode
      </button>

      {msg && <pre style={{ color: "green" }}>{msg}</pre>}
      {job.error_message && <pre style={{ color: "crimson" }}>{job.error_message}</pre>}

      <a href="/lab/inbox">Back</a>
    </div>
  );
}
