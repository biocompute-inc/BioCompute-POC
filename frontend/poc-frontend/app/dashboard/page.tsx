/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardInner />
    </RequireAuth>
  );
}

function DashboardInner() {
  const { user, logout } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setErr(null);
      try {
        const data = await apiFetch("/jobs");
        if (!cancelled) setJobs(data);
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
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <h1>Dashboard</h1>
          <div>{user?.email} ({user?.role})</div>
        </div>
        <button onClick={logout}>Logout</button>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
        <a href="/new-job">Create new job</a>
        {(user?.role === "scientist" || user?.role === "admin") && (
          <a href="/lab/inbox">Lab inbox</a>
        )}
      </div>

      <h2 style={{ marginTop: 20 }}>Jobs</h2>
      {err && <pre style={{ color: "crimson" }}>{err}</pre>}
      <ul>
        {jobs.map((j) => (
          <li key={j.id}>
            <a href={`/jobs/${j.id}`}>{j.id}</a> — {j.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
