/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";


function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardInner />
    </RequireAuth>
  );
}

function DashboardInner() {
  const { user, logout } = useAuth();

  const [summary, setSummary] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  //const router = useRouter();
  const greetingName = useMemo(() => {
    return summary?.display_name || user?.display_name || user?.email || "User";
  }, [summary, user]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setErr(null);
      try {
        const s = await apiFetch("/dashboard/summary");
        const f = await apiFetch("/dashboard/files");
        if (!cancelled) {
          setSummary(s);
          setFiles(f);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Hi, {greetingName}!</h1>
        <button onClick={logout}>Log Out</button>
      </div>

      {err && <pre style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{err}</pre>}

      <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, minWidth: 200 }}>
          <div style={{ fontSize: 32 }}>{summary?.total_files ?? "—"}</div>
          <div>Total Files</div>
        </div>
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, minWidth: 200 }}>
          <div style={{ fontSize: 32 }}>
            {summary ? formatBytes(summary.total_storage_bytes) : "—"}
          </div>
          <div>Total Storage</div>
        </div>
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, minWidth: 200 }}>
          <div style={{ fontSize: 32 }}>{summary?.total_retrievals ?? "—"}</div>
          <div>Total Retrievals</div>
        </div>
      </div>

      <div style={{ marginTop: 18, display: "flex", gap: 12 }}>
        <a href="/new-job">+ Upload a File</a>
        {(user?.role === "scientist" || user?.role === "admin") && <a href="/lab/inbox">Lab Inbox</a>}
      </div>

      <h2 style={{ marginTop: 20 }}>Your Data</h2>

      <div style={{ border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f3f3f3" }}>
            <tr>
              <th style={{ textAlign: "left", padding: 10 }}>#</th>
              <th style={{ textAlign: "left", padding: 10 }}>File Name</th>
              <th style={{ textAlign: "left", padding: 10 }}>Date Uploaded</th>
              <th style={{ textAlign: "left", padding: 10 }}>Size</th>
              <th style={{ textAlign: "left", padding: 10 }}>Status</th>
              <th style={{ textAlign: "left", padding: 10 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {files.map((r, idx) => (
              <tr key={r.file_id} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: 10 }}>{idx + 1}</td>
                <td style={{ padding: 10, maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.file_name}
                </td>
                <td style={{ padding: 10 }}>
                  {r.uploaded_at ? new Date(r.uploaded_at).toLocaleDateString() : "-"}
                </td>
                <td style={{ padding: 10 }}>{formatBytes(r.size_bytes)}</td>
                <td style={{ padding: 10 }}>{r.status}</td>
                <td style={{ padding: 10 }}>
                  {r.job_id ? <a href={`/jobs/${r.job_id}`}>View</a> : "-"}
                </td>
              </tr>
            ))}
            {files.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 14 }}>
                  No files yet. Upload one to create your first job.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>       
    </div>
  );
}
