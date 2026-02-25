/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { RequireRole } from "@/components/RequireAuth";
import Loading from "@/components/Loading";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bell,
  ClipboardList,
  Info,
  Mail,
  Sparkles,
} from "lucide-react";


export default function LabInboxPage() {
  return (
    <RequireRole allowed={["scientist", "admin"]}>
      <InboxInner />
    </RequireRole>
  );
}

function typeStyles(type?: string) {
  const t = (type || "").toLowerCase();
  if (t.includes("error") || t.includes("fail")) {
    return "bg-red-50 text-red-700 ring-red-200";
  }
  if (t.includes("warning") || t.includes("attention")) {
    return "bg-yellow-50 text-yellow-800 ring-yellow-200";
  }
  if (t.includes("success") || t.includes("complete")) {
    return "bg-green-50 text-green-700 ring-green-200";
  }
  if (t.includes("job") || t.includes("lab")) {
    return "bg-purple-50 text-purple-700 ring-purple-200";
  }
  return "bg-gray-50 text-gray-700 ring-gray-200";
}

function iconForType(type?: string) {
  const t = (type || "").toLowerCase();
  if (t.includes("job") || t.includes("lab")) return ClipboardList;
  if (t.includes("success") || t.includes("complete")) return Sparkles;
  if (t.includes("error") || t.includes("fail") || t.includes("warning"))
    return Info;
  return Bell;
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

  const hasItems = items.length > 0;

  const sortedItems = useMemo(() => {

    return [...items].sort((a, b) => {
      const at = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bt - at;
    });
  }, [items]);

  return (
    <main className="min-h-screen bg-purple-50">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <header className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-purple-100">
                  <Bell className="h-5 w-5 text-purple-700" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
                    Lab Inbox
                  </h1>
                  <p className="mt-1 text-sm text-gray-500">
                    Signals, alerts, and things that require your attention.
                  </p>
                </div>
              </div>
              <div className="mt-4 text-sm text-gray-600">
                {loading ? null : (
                  <span className="inline-flex items-center gap-1">
                    {hasItems ? (
                      <>
                        You have

                        {/* Icon + Badge */}
                        <span className="relative inline-flex items-center mx-1">
                          <Mail className="h-5 w-5 align-middle" />

                          <span className="absolute -top-1.5 -right-2 bg-purple-500 text-white text-[10px] leading-none px-1.5 py-0.5 rounded-full border-b-white border-1">
                            {items.length}
                          </span>
                        </span>

                        notification{items.length === 1 ? "" : "s"}.
                      </>
                    ) : (
                      "No new notifications."
                    )}
                  </span>
                )}
              </div>
            </div>

            <Link
              href="/scientist/jobs"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-purple-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Your dashboard
            </Link>
          </div>

          {/* Error */}
          {err && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {err}
            </div>
          )}
        </header>

        {/* Body */}
        <section className="mt-6">
          {/* Loading skeletons */}
          {loading && <Loading />}

          {/* Empty state */}
          {!loading && !err && items.length === 0 && (
            <div className="rounded-3xl border border-dashed border-purple-200 bg-white p-10 text-center shadow-sm">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-purple-100">
                <Sparkles className="h-6 w-6 text-purple-700" />
              </div>
              <div className="mt-4 text-lg font-bold text-gray-900">
                Inbox is empty
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Either things are going well, or nothing has started yet.
              </p>
              <Link
                href="/dashboard"
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-700"
              >
                Go to dashboard
              </Link>
            </div>
          )}

          {/* Items */}
          {!loading && !err && items.length > 0 && (
            <div className="space-y-3">
              {sortedItems.map((n) => {
                const Icon = iconForType(n.type);
                return (
                  <div
                    key={n.id}
                    className="group rounded-2xl bg-white p-5 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-purple-50">
                          <Icon className="h-5 w-5 text-purple-700" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${typeStyles(
                                n.type
                              )}`}
                            >
                              {n.type || "Notification"}
                            </span>

                            {n.created_at && (
                              <span className="text-xs text-gray-400">
                                {new Date(n.created_at).toLocaleString()}
                              </span>
                            )}
                          </div>

                          <div className="mt-2 font-semibold text-gray-900">
                            {n.title}
                          </div>

                          {n.message && (
                            <div className="mt-1 text-sm text-gray-600">
                              {n.message}
                            </div>
                          )}
                        </div>
                      </div>

                      {n.job_id && (
                        <Link
                          href={`/lab/jobs/${n.job_id}`}
                          className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-purple-700 ring-1 ring-purple-200 hover:bg-purple-50"
                        >
                          Open job →
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

