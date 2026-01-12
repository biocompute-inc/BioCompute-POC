/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { RequireRole } from "@/components/RequireAuth";
import { apiFetch } from "@/lib/api";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

type UsersRow = {
  user_id: number;
  email: string;
  display_name: string | null;
  total_files: number;
  total_storage_bytes: number;
  total_retrievals: number;
};

type StaffRow = {
  user_id: number;
  email: string;
  display_name: string | null;
  role: "scientist" | "admin";
  status: "BUSY" | "FREE" | "N/A";
  active_jobs: number | null;
};

export default function AdminDashboardPage() {
  return (
    <RequireRole allowed={["admin"]}>
      <AdminDashboardInner />
    </RequireRole>
  );
}

function AdminDashboardInner() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UsersRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [summary, setSummary] = useState<{ total_scientists: number; busy_scientists: number; free_scientists: number } | null>(null);

  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setErr(null);
      setLoading(true);
      try {
        const usersData = await apiFetch("/admin/analytics/users");
        const staffData = await apiFetch("/admin/analytics/staff");

        if (!cancelled) {
          setUsers(usersData);
          setStaff(staffData.staff);
          setSummary(staffData.summary);
        }
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
    <div style={{ maxWidth: 1200, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Hi {greetingName} Welcome to your Dashboard</h1>
        <a href="/dashboard">Back</a>
      </div>

      {err && <pre style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{err}</pre>}
      {loading && <div style={{ padding: 8 }}>Loading…</div>}

      {/* Cards */}
      <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
        <Card title="Total Scientists" value={summary?.total_scientists ?? "—"} />
        <Card title="Busy Scientists" value={summary?.busy_scientists ?? "—"} />
        <Card title="Free Scientists" value={summary?.free_scientists ?? "—"} />
      </div>

      {/* Users Table */}
      <h2 style={{ marginTop: 22 }}>Users</h2>
      <div style={{ border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f3f3f3" }}>
            <tr>
              <th style={{ textAlign: "left", padding: 10 }}>User</th>
              <th style={{ textAlign: "left", padding: 10 }}>Email</th>
              <th style={{ textAlign: "left", padding: 10 }}>Total Files</th>
              <th style={{ textAlign: "left", padding: 10 }}>Total Storage</th>
              <th style={{ textAlign: "left", padding: 10 }}>Total Retrievals</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: 10 }}>{u.display_name || "-"}</td>
                <td style={{ padding: 10 }}>{u.email}</td>
                <td style={{ padding: 10 }}>{u.total_files}</td>
                <td style={{ padding: 10 }}>{formatBytes(u.total_storage_bytes)}</td>
                <td style={{ padding: 10 }}>{u.total_retrievals}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 12 }}>
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Staff Table */}
      <h2 style={{ marginTop: 22 }}>Staff</h2>
      <div style={{ border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f3f3f3" }}>
            <tr>
              <th style={{ textAlign: "left", padding: 10 }}>Name</th>
              <th style={{ textAlign: "left", padding: 10 }}>Email</th>
              <th style={{ textAlign: "left", padding: 10 }}>Role</th>
              <th style={{ textAlign: "left", padding: 10 }}>Status</th>
              <th style={{ textAlign: "left", padding: 10 }}>Active Jobs</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.user_id} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: 10 }}>{s.display_name || "-"}</td>
                <td style={{ padding: 10 }}>{s.email}</td>
                <td style={{ padding: 10 }}>{s.role}</td>
                <td style={{ padding: 10 }}>
                  <StatusPill status={s.status} />
                </td>
                <td style={{ padding: 10 }}>{s.active_jobs ?? "-"}</td>
              </tr>
            ))}
            {staff.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 12 }}>
                  No staff accounts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16 }}>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: "8px 12px" }}
        >
          Refresh
        </button>
                   <button
              type="button"
              onClick={() => router.push("/admin")}
              className="text-sm text-slate-500 hover:underline"
            >
              Create user
            </button> 
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: any }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, minWidth: 220 }}>
      <div style={{ fontSize: 32, fontWeight: 600 }}>{value}</div>
      <div style={{ opacity: 0.8 }}>{title}</div>
    </div>
  );
}

function StatusPill({ status }: { status: "BUSY" | "FREE" | "N/A" }) {
  const bg = status === "BUSY" ? "#ffe4e4" : status === "FREE" ? "#e5ffe4" : "#eee";
  const bd = status === "BUSY" ? "#ff8a8a" : status === "FREE" ? "#76d56f" : "#bbb";
  return (
    <span style={{ padding: "4px 10px", borderRadius: 999, border: `1px solid ${bd}`, background: bg }}>
      {status}
    </span>
  );
}
