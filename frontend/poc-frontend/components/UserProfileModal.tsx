"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function UserProfileModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/40" />

      <div className="relative w-[92vw] max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Your profile</div>
            <div className="text-sm text-gray-500">Account details</div>
          </div>

          <button
            className="rounded-lg px-2 py-1 text-sm hover:bg-gray-100"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <div className="rounded-xl bg-gray-50 p-3">
            <div className="text-gray-500">Display name</div>
            <div className="font-medium">{user?.display_name ?? "—"}</div>
          </div>

          <div className="rounded-xl bg-gray-50 p-3">
            <div className="text-gray-500">Email</div>
            <div className="font-medium">{user?.email ?? "—"}</div>
          </div>

          {/* <div className="rounded-xl bg-gray-50 p-3">
            <div className="text-gray-500">Role</div>
            <div className="font-medium">{user?.role ?? "—"}</div>
          </div> */}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
            onClick={onClose}
          >
            Close
          </button>

          <button
            className="rounded-xl bg-purple-500 px-4 py-2 text-sm text-white hover:opacity-90"
            onClick={() => {
              onClose();
              router.push("/profile");
            }}
          >
            Update profile
          </button>
        </div>
      </div>
    </div>
  );
}