/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { RequireRole } from "@/components/RequireAuth";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import Image from "next/image"
import avator1 from "@/app/assets/avator1.png"
import { useEffect, useMemo, useRef, useState } from "react";
import UserProfileModal from "@/components/UserProfileModal";
import Counter from "@/components/Counter";
import {
  Ban,
  Database,
  Download,
  DownloadIcon,
  FileText,
  LogOut,
  PanelLeftOpen,
  Plus,
  Trash2,
  AlertTriangle,
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

export default function DashboardPage() {
  return (
    <RequireRole allowed={["user"]}>
      <DashboardInner />
    </RequireRole>
  );
}

function StatusCell({ status, progress = 45 }: { status: string; progress?: number }) {
  const s = (status || "").toLowerCase();

  const isStored = s === "stored" || s === "complete" || s === "completed";
  const isEncoding = s.includes("encod");
  const isRetrieving = s.includes("retriev");

  if (isStored) {
    return <span className="text-gray-700">Stored</span>;
  }

  const label = isEncoding ? "Encoding..." : isRetrieving ? "Retrieving..." : `${status}...`;

  return (
    <div className="min-w-170px">
      <div className="text-gray-700">{label}</div>
      <div className="mt-2 h-1 w-full rounded bg-gray-200">
        <div
          className="h-1 rounded bg-purple-400"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      <div className="mt-2 text-xs text-gray-500">Estimated time: 24h</div>
    </div>
  );
}

function ActionCell({
  status,
  jobId,
  fileId,
}: {
  status: string;
  jobId?: string | null;
  fileId?: string | null;
}) {
  const s = (status || "").toLowerCase();
  const isStored = s === "stored" || s === "complete" || s === "completed";
  const isBusy = s.includes("encod") || s.includes("retriev") || s.includes("process");

  if (isStored) {
    return (
      <Link
        href={`/user/jobs/${jobId}?mode=retrieve`}
        className="inline-flex items-center gap-2 whitespace-nowrapfont-medium text-purple-600 hover:text-purple-700"
      >
        <DownloadIcon className="h-4 w-4" />
        Retrieve
      </Link>
    );
  }

  if (isBusy) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-2 whitespace-nowrap font-medium text-purple-400 hover:text-purple-500"
        onClick={() => {
          console.log("Cancel", { fileId, jobId });
        }}
      >
        <Ban className="h-4 w-4" />
        Cancel
      </button>
    );
  }

  if (jobId) {
    return (
      <Link
        href={`/user/jobs/${jobId}?mode=view`}
        className="inline-flex items-center gap-2 whitespace-nowrap font-medium text-purple-600 hover:text-purple-700"
      >
        <PanelLeftOpen className="h-4 w-4" />
        View
      </Link>
    );
  }

  return <span className="text-gray-400">-</span>;
}


function ConfirmDangerModal({
  open,
  title = "Deactivate account",
  description,
  confirmText = "Deactivate",
  cancelText = "Cancel",
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    // prevent background scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // focus Cancel
    const t = window.setTimeout(() => cancelBtnRef.current?.focus(), 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!loading) onCancel();
        return;
      }

      // Focus trap
      if (e.key === "Tab") {
        const root = panelRef.current;
        if (!root) return;

        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute("disabled"));

        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40"
        onClick={() => !loading && onCancel()}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex gap-6 px-10 py-8">
          {/* Icon */}
          <div className="mt-1 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>

          {/* Text */}
          <div className="max-w-2xl">
            <h3 className="text-2xl font-semibold text-slate-900">{title}</h3>
            <p className="mt-3 text-base leading-relaxed text-slate-500">{description}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-4 bg-slate-50 px-10 py-6">
          <button
            ref={cancelBtnRef}
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-7 py-3 text-base font-semibold text-slate-900 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            {cancelText}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="rounded-xl bg-red-600 px-7 py-3 text-base font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? "Deactivating..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardInner() {
  const { user, logout } = useAuth();

  const [summary, setSummary] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [openProfile, setOpenProfile] = useState(false);


  const openDeleteBtnRef = useRef<HTMLButtonElement | null>(null);

  async function deleteAccount() {
    if (deleting) return;

    setErr(null);
    setDeleting(true);

    try {
      const res = await fetch("http://localhost:8000/auth/delete-account", {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) throw new Error(await res.text());

      await logout();
      window.location.href = "/login";
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
      // restore focus to opener
      openDeleteBtnRef.current?.focus();
    }
  }

  const greetingName = useMemo(() => {
    return user?.display_name || user?.email || "User";
  }, [user]);

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
    <main className="min-h-screen bg-purple-50">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pb-24">
        {/* Header */}
        <header className="flex items-center justify-between pt-8">
          <button type="button"
            onClick={() => setOpenProfile(true)}
            className="flex  items-center gap-3 rounded-2xl bg-white/60 px-5 py-3 shadow-sm backdrop-blur text-left hover:bg-white/70">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-100">
              <Image
                src={avator1}
                alt="DNA Data Storage Vault"
                width={360}
                height={200}
                className="object-cover rounded-2xl"
                priority
              />
            </div>
            <div className="text-2xl font-extrabold text-purple-700">Hi, {greetingName ?? "there"}!</div>

          </button>
          <UserProfileModal open={openProfile} onClose={() => setOpenProfile(false)} />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-xl bg-white/60 px-4 py-2.5 text-purple-600 shadow-sm backdrop-blur hover:bg-white/80"
            >
              <LogOut className="h-4 w-4" />
              <span className="font-medium">Log Out</span>
            </button>

            <button
              ref={openDeleteBtnRef}
              type="button"
              onClick={() => {
                setErr(null);
                setShowDeleteConfirm(true);
              }}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-xl bg-red-50/80 px-4 py-2.5 text-red-700 shadow-sm backdrop-blur hover:bg-red-100 disabled:opacity-60"
              title="Delete your account"
            >
              <Trash2 className="h-4 w-4" />
              <span className="font-medium">{deleting ? "Deleting..." : "Delete Account"}</span>
            </button>
          </div>
        </header>

        {/* Error */}
        {err && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <pre className="whitespace-pre-wrap">{err}</pre>
          </div>
        )}

        {/* Overview Banner */}
        <section className="mt-8">
          <div className="relative overflow-hidden rounded-3xl bg-purple-500 px-6 sm:px-8 pt-8 pb-24">
            <div className="flex items-center gap-4">
              <div className="h-10 w-1.5 rounded-full bg-white/95" />
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Your Overview</h1>
            </div>

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

          {/* Stats Cards (overlap) */}
          <div className="-mt-16 relative z-10">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-3xl font-extrabold text-gray-900">
                      {summary?.total_files !== undefined ? (
                        <Counter value={summary.total_files} />
                      ) : (
                        "—"
                      )}
                    </div>
                    <div className="mt-1 text-sm text-gray-500">Total Files</div>
                  </div>
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-purple-100">
                    <FileText className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-3xl font-extrabold text-gray-900">
                      {summary?.total_storage_bytes !== undefined ? (
                        <Counter
                          value={summary.total_storage_bytes}
                          formatter={(val) => formatBytes(val)}
                        />
                      ) : (
                        "—"
                      )}
                    </div>
                    <div className="mt-1 text-sm text-gray-500">Total Storage</div>
                  </div>
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-purple-100">
                    <Database className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-3xl font-extrabold text-gray-900">
                      {summary?.total_retrievals !== undefined ? (
                        <Counter value={summary.total_retrievals} />
                      ) : (
                        "—"
                      )}
                    </div>
                    <div className="mt-1 text-sm text-gray-500">Total Retrievals</div>
                  </div>
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-purple-100">
                    <Download className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Links */}
        <section className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/user/new-job"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-purple-700 shadow-sm hover:bg-white/80"
          >
            <Plus className="h-4 w-4" />
            <span className="font-medium">Upload a File</span>
          </Link>

          {(user?.role === "scientist" || user?.role === "admin") && (
            <Link
              href="/scientist/inbox"
              className="inline-flex items-center rounded-xl bg-white px-4 py-2.5 text-purple-700 shadow-sm hover:bg-white/80"
            >
              <span className="font-medium">Lab Inbox</span>
            </Link>
          )}
        </section>

        {/* Data Table */}
        <section className="mt-10">
          <h2 className="text-xl font-extrabold text-purple-700">Your Data</h2>

          <div className="mt-4 rounded-xl bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-900px w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Sr. No.
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      File Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Date Uploaded
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Size
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {files.map((r, idx) => (
                    <tr
                      key={r.file_id ?? `${idx}`}
                      className="border-b border-gray-100 last:border-b-0"
                    >
                      <td className="px-6 py-5 text-sm text-gray-700">{idx + 1}</td>

                      <td className="px-6 py-5 text-sm text-gray-700">
                        <div className="w-64 truncate">{r.file_name}</div>
                      </td>

                      <td className="px-6 py-5 text-sm text-gray-700">
                        {r.uploaded_at ? new Date(r.uploaded_at).toLocaleDateString() : "-"}
                      </td>

                      <td className="px-6 py-5 text-sm text-gray-700">
                        {typeof r.size_bytes === "number" ? formatBytes(r.size_bytes) : "-"}
                      </td>

                      <td className="px-6 py-5 text-sm">
                        <StatusCell status={r.status} progress={r.progress_pct ?? 45} />
                      </td>

                      <td className="px-6 py-5 text-sm">
                        <ActionCell status={r.status} jobId={r.job_id} fileId={r.file_id} />
                      </td>
                    </tr>
                  ))}

                  {files.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-6 text-sm text-gray-500">
                        No files yet. Upload one to create your first job.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {/* FAB */}
      <Link
        href="/user/new-job"
        className="fixed bottom-6 right-6 inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-5 py-3 text-white shadow-lg hover:bg-purple-700"
        aria-label="Upload a File"
      >
        <Plus className="h-5 w-5" />
        <span className="font-semibold">Upload a File</span>
      </Link>

      {/* Delete Confirm Modal (matches screenshot style) */}
      <ConfirmDangerModal
        open={showDeleteConfirm}
        title="Deactivate account"
        description="Are you sure you want to deactivate your account? All of your data will be permanently removed. This action cannot be undone."
        confirmText="Deactivate"
        cancelText="Cancel"
        loading={deleting}
        onCancel={() => {
          if (deleting) return;
          setShowDeleteConfirm(false);
          openDeleteBtnRef.current?.focus();
        }}
        onConfirm={deleteAccount}
      />
    </main>
  );
}
