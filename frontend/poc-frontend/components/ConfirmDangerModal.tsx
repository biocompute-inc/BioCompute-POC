"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

export default function ConfirmDangerModal({
  open,
  title = "Confirm action",
  description,
  confirmText = "Confirm",
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

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const t = window.setTimeout(() => cancelBtnRef.current?.focus(), 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!loading) onCancel();
        return;
      }

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
            <p className="mt-3 text-base leading-relaxed text-slate-500">
              {description}
            </p>
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
            {loading ? "Deleting..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
