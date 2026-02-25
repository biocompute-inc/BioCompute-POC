/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { RequireRole } from "@/components/RequireAuth";
import Loading from "@/components/Loading";
import { apiFetch } from "@/lib/api";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  Users,
  UserCog,
  RefreshCw,
  Search,
  ChevronUp,
  ChevronDown,
  Filter,
  UserPlus,
  LogOut,
  UserStar,
} from "lucide-react";

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

type SortDir = "asc" | "desc";

type UsersSortKey =
  | "display_name"
  | "email"
  | "total_files"
  | "total_storage_bytes"
  | "total_retrievals";

type StaffSortKey = "display_name" | "email" | "role" | "status" | "active_jobs";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function compare(a: any, b: any, dir: SortDir) {
  const mult = dir === "asc" ? 1 : -1;

  // handle null/undefined
  const aNil = a === null || a === undefined || a === "";
  const bNil = b === null || b === undefined || b === "";
  if (aNil && bNil) return 0;
  if (aNil) return 1 * mult; // push nils down
  if (bNil) return -1 * mult;

  // number vs string
  if (typeof a === "number" && typeof b === "number") {
    return (a - b) * mult;
  }
  return String(a).localeCompare(String(b), undefined, { sensitivity: "base" }) * mult;
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="text-gray-300">↕</span>;
  return dir === "asc" ? (
    <ChevronUp className="h-4 w-4 text-gray-500" />
  ) : (
    <ChevronDown className="h-4 w-4 text-gray-500" />
  );
}

export default function AdminDashboardPage() {
  return (
    <RequireRole allowed={["admin"]}>
      <AdminDashboardInner />
    </RequireRole>
  );
}

function AdminDashboardInner() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState<UsersRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [summary, setSummary] = useState<{
    total_scientists: number;
    busy_scientists: number;
    free_scientists: number;
  } | null>(null);

  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // UI state: search / filters / sorting
  const [userQuery, setUserQuery] = useState("");
  const [staffQuery, setStaffQuery] = useState("");
  const [staffStatusFilter, setStaffStatusFilter] = useState<"ALL" | "FREE" | "BUSY" | "N/A">("ALL");

  const [usersSort, setUsersSort] = useState<{ key: UsersSortKey; dir: SortDir }>({
    key: "total_files",
    dir: "desc",
  });

  const [staffSort, setStaffSort] = useState<{ key: StaffSortKey; dir: SortDir }>({
    key: "status",
    dir: "asc",
  });

  const router = useRouter();

  const greetingName = useMemo(() => {
    return user?.display_name || user?.email || "User";
  }, [user]);

  const load = async () => {
    setErr(null);
    setLoading(true);
    try {
      const usersData = await apiFetch("/admin/analytics/users");
      const staffData = await apiFetch("/admin/analytics/staff");
      setUsers(usersData);
      setStaff(staffData.staff);
      setSummary(staffData.summary);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

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

  const filteredSortedUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    const filtered = q
      ? users.filter((u) => {
          const name = (u.display_name || "").toLowerCase();
          const email = (u.email || "").toLowerCase();
          return name.includes(q) || email.includes(q);
        })
      : users;

    const { key, dir } = usersSort;
    return [...filtered].sort((x, y) => compare((x as any)[key], (y as any)[key], dir));
  }, [users, userQuery, usersSort]);

  const filteredSortedStaff = useMemo(() => {
    const q = staffQuery.trim().toLowerCase();
    const filteredByQuery = q
      ? staff.filter((s) => {
          const name = (s.display_name || "").toLowerCase();
          const email = (s.email || "").toLowerCase();
          return name.includes(q) || email.includes(q);
        })
      : staff;

    const filteredByStatus =
      staffStatusFilter === "ALL"
        ? filteredByQuery
        : filteredByQuery.filter((s) => s.status === staffStatusFilter);

    const { key, dir } = staffSort;

    return [...filteredByStatus].sort((x, y) => {
      // active_jobs should sort nulls last
      if (key === "active_jobs") {
        const ax = x.active_jobs ?? Number.NEGATIVE_INFINITY;
        const ay = y.active_jobs ?? Number.NEGATIVE_INFINITY;
        // For active_jobs, treat null as very small, then push nulls down by compare() logic below
        return compare(x.active_jobs, y.active_jobs, dir);
      }
      return compare((x as any)[key], (y as any)[key], dir);
    });
  }, [staff, staffQuery, staffStatusFilter, staffSort]);

  const toggleUsersSort = (key: UsersSortKey) => {
    setUsersSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: "asc" };
    });
  };

  const toggleStaffSort = (key: StaffSortKey) => {
    setStaffSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: "asc" };
    });
  };

  return (
    <main className="min-h-screen bg-purple-50">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pb-24">
        {/* Top header */}
        <header className="flex items-center justify-between pt-8">
          <div className="flex items-center gap-3 rounded-2xl bg-white/60 px-5 py-3 shadow-sm backdrop-blur">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-100">
              <UserStar className="h-5 w-5 text-purple-700" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-purple-700">Hi {greetingName}</div>
              <div className="text-sm text-gray-500">Welcome to your Admin Dashboard</div>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-xl bg-white/60 px-4 py-2.5 text-purple-600 shadow-sm backdrop-blur hover:bg-white/80"
          >
            <LogOut className="h-4 w-4" />
            <span className="font-medium">Log Out</span>
          </button>
        </header>

        {/* Banner */}
        <section className="mt-8">
          <div className="relative overflow-hidden rounded-3xl bg-purple-500 px-6 sm:px-8 pt-8 pb-24">
            <div className="flex items-center gap-4">
              <div className="h-10 w-1.5 rounded-full bg-white/95" />
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Analytics Overview</h1>
            </div>
            <div className="mt-4 text-white/90">Users usage + staff availability at a glance.</div>

            {/* Wavy bottom edge */}
            <svg
              className="absolute bottom-0 left-0 w-full"
              viewBox="0 0 1440 160"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M0,64 C240,140 480,140 720,92 C960,44 1200,44 1440,92 L1440,160 L0,160 Z"
                fill="#F3E8FF"
              />
            </svg>
          </div>

          {/* Summary cards overlap */}
          <div className="-mt-16 relative z-10">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <SummaryCard
                title="Total Scientists"
                value={summary?.total_scientists ?? "—"}
                icon={<Users className="h-6 w-6 text-purple-700" />}
              />
              <SummaryCard
                title="Busy Scientists"
                value={summary?.busy_scientists ?? "—"}
                icon={<UserCog className="h-6 w-6 text-purple-700" />}
              />
              <SummaryCard
                title="Free Scientists"
                value={summary?.free_scientists ?? "—"}
                icon={<Users className="h-6 w-6 text-purple-700" />}
              />
            </div>

            {/* Actions row */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-gray-600">
                {loading ? (<Loading />) : (
                  <span>
                    Showing <span className="font-semibold">{filteredSortedUsers.length}</span> user
                    row{filteredSortedUsers.length === 1 ? "" : "s"} and{" "}
                    <span className="font-semibold">{filteredSortedStaff.length}</span> staff row
                    {filteredSortedStaff.length === 1 ? "" : "s"}.
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={load}
                  className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 disabled:opacity-60"
                  disabled={loading}
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/admin")}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-purple-700 shadow-sm ring-1 ring-purple-200 hover:bg-purple-50"
                >
                  <UserPlus className="h-4 w-4" />
                  Create user
                </button>
              </div>
            </div>

            {err && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm">
                <pre className="whitespace-pre-wrap">{err}</pre>
              </div>
            )}
          </div>
        </section>

        {/* Users table */}
        <section className="mt-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-xl font-extrabold text-purple-700">Users</h2>

            {/* Search */}
            <div className="w-full sm:w-360px">
              <label className="text-xs font-semibold text-gray-500">Search users</label>
              <div className="mt-1 flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-gray-100">
                <Search className="h-4 w-4 text-gray-400" />
                <input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Name or email…"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-white shadow-sm">
            {/* Sticky header + scroll body */}
            <div className="max-h-520px overflow-auto rounded-xl">
              <table className="min-w-900px w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-gray-100">
                    <SortableTh
                      label="User"
                      active={usersSort.key === "display_name"}
                      dir={usersSort.dir}
                      onClick={() => toggleUsersSort("display_name")}
                    />
                    <SortableTh
                      label="Email"
                      active={usersSort.key === "email"}
                      dir={usersSort.dir}
                      onClick={() => toggleUsersSort("email")}
                    />
                    <SortableTh
                      label="Total Files"
                      active={usersSort.key === "total_files"}
                      dir={usersSort.dir}
                      onClick={() => toggleUsersSort("total_files")}
                      right
                    />
                    <SortableTh
                      label="Total Storage"
                      active={usersSort.key === "total_storage_bytes"}
                      dir={usersSort.dir}
                      onClick={() => toggleUsersSort("total_storage_bytes")}
                      right
                    />
                    <SortableTh
                      label="Total Retrievals"
                      active={usersSort.key === "total_retrievals"}
                      dir={usersSort.dir}
                      onClick={() => toggleUsersSort("total_retrievals")}
                      right
                    />
                  </tr>
                </thead>

                <tbody>
                  {filteredSortedUsers.map((u) => (
                    <tr key={u.user_id} className="border-b border-gray-100 last:border-b-0">
                      <td className="px-6 py-5 text-sm text-gray-800">{u.display_name || "-"}</td>
                      <td className="px-6 py-5 text-sm text-gray-700">
                        <div className="max-w-420px truncate">{u.email}</div>
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-700 text-right tabular-nums">
                        {u.total_files}
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-700 text-right tabular-nums">
                        {formatBytes(u.total_storage_bytes)}
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-700 text-right tabular-nums">
                        {u.total_retrievals}
                      </td>
                    </tr>
                  ))}

                  {filteredSortedUsers.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="px-6 py-6 text-sm text-gray-500">
                        No users match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Staff table */}
        <section className="mt-10">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="text-xl font-extrabold text-purple-700">Staff</h2>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end w-full">
              {/* Search */}
              <div className="w-full sm:w-[320px]">
                <label className="text-xs font-semibold text-gray-500">Search staff</label>
                <div className="mt-1 flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-gray-100">
                  <Search className="h-4 w-4 text-gray-400" />
                  <input
                    value={staffQuery}
                    onChange={(e) => setStaffQuery(e.target.value)}
                    placeholder="Name or email…"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div className="w-full sm:w-220px">
                <label className="text-xs font-semibold text-gray-500">Filter status</label>
                <div className="mt-1 flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-gray-100">
                  <Filter className="h-4 w-4 text-gray-400" />
                  <select
                    value={staffStatusFilter}
                    onChange={(e) => setStaffStatusFilter(e.target.value as any)}
                    className="w-full bg-transparent text-sm outline-none"
                  >
                    <option value="ALL">All</option>
                    <option value="FREE">FREE</option>
                    <option value="BUSY">BUSY</option>
                    <option value="N/A">N/A</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-white shadow-sm">
            <div className="max-h-520px overflow-auto rounded-xl">
              <table className="min-w-900px w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-gray-100">
                    <SortableTh
                      label="Name"
                      active={staffSort.key === "display_name"}
                      dir={staffSort.dir}
                      onClick={() => toggleStaffSort("display_name")}
                    />
                    <SortableTh
                      label="Email"
                      active={staffSort.key === "email"}
                      dir={staffSort.dir}
                      onClick={() => toggleStaffSort("email")}
                    />
                    <SortableTh
                      label="Role"
                      active={staffSort.key === "role"}
                      dir={staffSort.dir}
                      onClick={() => toggleStaffSort("role")}
                    />
                    <SortableTh
                      label="Status"
                      active={staffSort.key === "status"}
                      dir={staffSort.dir}
                      onClick={() => toggleStaffSort("status")}
                    />
                    <SortableTh
                      label="Active Jobs"
                      active={staffSort.key === "active_jobs"}
                      dir={staffSort.dir}
                      onClick={() => toggleStaffSort("active_jobs")}
                      right
                    />
                  </tr>
                </thead>

                <tbody>
                  {filteredSortedStaff.map((s) => (
                    <tr key={s.user_id} className="border-b border-gray-100 last:border-b-0">
                      <td className="px-6 py-5 text-sm text-gray-800">{s.display_name || "-"}</td>
                      <td className="px-6 py-5 text-sm text-gray-700">
                        <div className="max-w-420px truncate">{s.email}</div>
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-700 capitalize">{s.role}</td>
                      <td className="px-6 py-5 text-sm">
                        <StatusPill status={s.status} />
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-700 text-right tabular-nums">
                        {s.active_jobs ?? "-"}
                      </td>
                    </tr>
                  ))}

                  {filteredSortedStaff.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="px-6 py-6 text-sm text-gray-500">
                        No staff match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: any;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-3xl font-extrabold text-gray-900 tabular-nums">{value}</div>
          <div className="mt-1 text-sm text-gray-500">{title}</div>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-purple-100">
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: "BUSY" | "FREE" | "N/A" }) {
  if (status === "BUSY") {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">
        BUSY
      </span>
    );
  }
  if (status === "FREE") {
    return (
      <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-200">
        FREE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
      N/A
    </span>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
  right,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  right?: boolean;
}) {
  return (
    <th
      className={cn(
        "px-6 py-4 text-sm font-semibold text-gray-400 select-none",
        right ? "text-right" : "text-left"
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-2 hover:text-gray-600",
          right && "justify-end w-full"
        )}
      >
        <span>{label}</span>
        <SortIcon active={active} dir={dir} />
      </button>
    </th>
  );
}

