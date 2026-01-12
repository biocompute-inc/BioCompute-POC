/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useAuth } from "@/components/AuthProvider";
import { RequireRole } from "@/components/RequireAuth";
import { apiFetch } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

type ScientistJob = {
  id: string;
  status: string;
  created_at: string | null;
  file_id: string;
  protocol_download_url: string | null;
  match: boolean | null;
};

export default function ScientistJobsPage() {
  return (
    <RequireRole allowed={["scientist", "admin"]}>
      <ScientistJobsInner />
    </RequireRole>
  );
}

function ScientistJobsInner() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<ScientistJob[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setErr(null);
      setLoading(true);
      try {
        const data = await apiFetch("/scientist/jobs");
        if (!cancelled) setJobs(data);
      } catch (e: any) {
        if (!cancelled) setErr(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

      const greetingName = useMemo(() => {
        return user?.display_name || user?.email || "User";
      }, [user]);

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Hi {greetingName}!</h1>
        <a href="/dashboard">Back</a>
      </div>

      {err && <pre style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{err}</pre>}
      {loading && <div style={{ padding: 8 }}>Loading…</div>}
    <h1>Your Assigned Jobs</h1>
      <div style={{ border: "1px solid #ddd", borderRadius: 8, overflow: "hidden", marginTop: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f3f3f3" }}>
            <tr>
              <th style={{ textAlign: "left", padding: 10 }}>Job ID</th>
              <th style={{ textAlign: "left", padding: 10 }}>Created</th>
              <th style={{ textAlign: "left", padding: 10 }}>Status</th>
              <th style={{ textAlign: "left", padding: 10 }}>Protocol</th>
              <th style={{ textAlign: "left", padding: 10 }}>Result</th>
              <th style={{ textAlign: "left", padding: 10 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: 10, fontFamily: "monospace" }}>{j.id}</td>
                <td style={{ padding: 10 }}>
                  {j.created_at ? new Date(j.created_at).toLocaleString() : "-"}
                </td>
                <td style={{ padding: 10 }}>{j.status}</td>
                <td style={{ padding: 10 }}>
                  {j.protocol_download_url ? (
                    <a href={`http://localhost:8000${j.protocol_download_url}`} target="_blank">
                      Download
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td style={{ padding: 10 }}>
                  {j.match === null ? "-" : j.match ? "✅ Match" : "❌ Mismatch"}
                </td>
                <td style={{ padding: 10 }}>
                  <a href={`/lab/jobs/${j.id}`}>Open</a>
                </td>
              </tr>
            ))}

            {jobs.length === 0 && !loading && (
              <tr>
                <td colSpan={6} style={{ padding: 14 }}>
                  No assigned jobs right now.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16 }}>
        <button onClick={() => window.location.reload()} style={{ padding: "8px 12px" }}>
          Refresh
        </button>
      </div>
    </div>
  );
}
