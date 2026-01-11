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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setErr(null);
      try {
        const data = await apiFetch("/notifications");
        if (!cancelled) setItems(data);
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

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          Lab Inbox
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Signals, alerts, and things that require your attention.
        </p>
      </div>

      {/* Error */}
      {err && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-sm text-gray-500">
          Loading notifications…
        </div>
      )}

      {/* Empty */}
      {!loading && items.length === 0 && !err && (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          Inbox is empty. Either things are going well or nothing has started yet.
        </div>
      )}

      {/* Inbox items */}
      <div className="space-y-3">
        {items.map((n) => (
          <div
            key={n.id}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 mb-1">
                  {n.type}
                </div>
                <div className="font-medium text-gray-900">
                  {n.title}
                </div>
              </div>

              {n.job_id && (
                <a
                  href={`/lab/jobs/${n.job_id}`}
                  className="text-sm font-medium text-black hover:underline whitespace-nowrap"
                >
                  Open job →
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-8">
        <a
          href="/dashboard"
          className="text-sm font-medium text-gray-500 hover:underline"
        >
          ← Back to dashboard
        </a>
      </div>
    </div>
  );
}
