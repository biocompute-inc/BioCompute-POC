/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { RequireRole } from "@/components/RequireAuth";
import { apiFetch } from "@/lib/api";
import Image from "next/image";
import avator1 from "@/app/assets/avator1.png"

export default function ProfilePage() {
  return (
    <RequireRole allowed={["user", "scientist", "admin"]}>
      <ProfilePageInner />
    </RequireRole>
  );
}

function ProfilePageInner() {
  const router = useRouter();
  const { user, loading, refresh } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(user?.display_name ?? "");
  }, [user?.display_name]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (!user) return null;

  async function onSave() {
    setSaving(true);
    setErr(null);
    try {
      const trimmed = displayName.trim();
      await apiFetch("/auth/profile", {
        method: "POST",
        body: JSON.stringify({ display_name: trimmed.length ? trimmed : null }),
      });

      await refresh();
      router.push("/user/dashboard");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-purple-50 px-4">
      <div className=" max-w-2xl rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center gap-3 text-lg font-bold text-purple-600">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-100">
            <Image
              src={avator1}
              alt="User Avatar"
              width={40}
              height={40}
              className="object-cover rounded-xl"
              priority
            />
          </div>
          <span>
            Hi, {user.display_name ?? "there"}!
          </span>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mt-4">
          Update your Profile
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Change your display name.
        </p>
        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Display Name
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How do you want to be called?"
              className=" rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-200"
            />

            <p className="mt-1 text-xs text-gray-500">
              Leaving this empty will clear your display name.
            </p>
          </div>
        </div>

        {/* Error */}
        {err && (
          <div className="mt-4 rounded-lg bg-red-50 p-2 text-xs text-red-700">
            {err}
          </div>
        )}

        {/* Buttons */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            disabled={saving}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>

          <button
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}