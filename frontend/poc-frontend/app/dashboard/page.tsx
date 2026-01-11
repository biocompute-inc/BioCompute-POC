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
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <div className="text-sm text-gray-500 mt-1">
            {user?.email}
            <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
              {user?.role}
            </span>
          </div>
        </div>

        <button
          onClick={logout}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Logout
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-4 mb-10">
        <a
          href="/new-job"
          className="inline-flex items-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          + New Job
        </a>

        {(user?.role === "scientist" || user?.role === "admin") && (
          <a
            href="/lab/inbox"
            className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Lab Inbox
          </a>
        )}
      </div>

      {/* Jobs */}
      <h2 className="text-xl font-semibold mb-4">Jobs</h2>

      {err && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {jobs.length === 0 && !err && (
        <div className="text-sm text-gray-500">
          No jobs yet. Create one and make the machines suffer.
        </div>
      )}

      <div className="grid gap-4">
        {jobs.map((j) => (
          <a
            key={j.id}
            href={`/jobs/${j.id}`}
            className="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
          >
            <div>
              <div className="font-medium">{j.id}</div>
              <div className="text-sm text-gray-500">
                Status: {j.status}
              </div>
            </div>

            <span className="text-sm text-gray-400">
              →
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
