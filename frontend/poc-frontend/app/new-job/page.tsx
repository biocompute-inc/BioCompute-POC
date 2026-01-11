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

  async function submit() {
    setErr(null);
    setMsg(null);
    if (!file) return;

    const form = new FormData();
    form.append("upload", file);

    const res = await fetch("http://localhost:8000/jobs/from-file", {
      method: "POST",
      credentials: "include",
      body: form,
    });

    if (!res.ok) {
      setErr(await res.text());
      return;
    }

    const data = await res.json();
    setMsg(`Created job: ${data.job_id}`);
    window.location.href = `/jobs/${data.job_id}`;
  }

  return (
    <div style={{ maxWidth: 700, margin: "24px auto", padding: 16 }}>
      <h1>Create Job</h1>
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <div style={{ marginTop: 12 }}>
        <button onClick={submit} disabled={!file}>
          Upload & Create Job
        </button>
      </div>
      {msg && <pre style={{ color: "green" }}>{msg}</pre>}
      {err && <pre style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{err}</pre>}
      <p style={{ marginTop: 12 }}>
        <a href="/dashboard">Back</a>
      </p>
    </div>
  );
}
