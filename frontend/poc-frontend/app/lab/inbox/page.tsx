/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { RequireRole } from "@/components/RequireAuth";
import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";

export default function LabInboxPage() {
  return (
    <RequireRole allowed={["scientist", "admin"]}>
      <InboxInner />
    </RequireRole>
  );
}

function InboxInner() {
  const [items, setItems] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setErr(null);
      try {
        const data = await apiFetch("/notifications");
        if (!cancelled) setItems(data);
      } catch (e: any) {
        if (!cancelled) setErr(e.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: "24px auto", padding: 16 }}>
      <h1>Lab Inbox</h1>
      {err && <pre style={{ color: "crimson" }}>{err}</pre>}
      <ul>
        {items.map((n) => (
          <li key={n.id}>
            <b>{n.type}</b> — {n.title} —{" "}
            {n.job_id && <a href={`/lab/jobs/${n.job_id}`}>Open job</a>}
          </li>
        ))}
      </ul>
      <a href="/dashboard">Back</a>
    </div>
  );
}
