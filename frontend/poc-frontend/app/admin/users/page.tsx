/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { RequireRole } from "@/components/RequireAuth";
import { apiFetch, parseError } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {  LogOut, UserPlus, UserStar } from "lucide-react";

export default function AdminCreateUserPage() {
  return (
    <RequireRole allowed={["admin"]}>
      <AdminCreateUserInner />
    </RequireRole>
  );
}

function AdminCreateUserInner() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"scientist" | "admin">("scientist");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          role,
          display_name: displayName,
        }),
      });

      setSuccess(`Created ${res.role}: ${res.email}`);
      setEmail("");
      setPassword("");
      setDisplayName("");
      setRole("scientist");
    } catch (err: any) {
      setError(parseError(err));
    }
  }
  const { user, logout } = useAuth();

    const greetingName = useMemo(() => {
      return  user?.display_name || user?.email || "User";
    }, [ user]);

  return (
  <div className="min-h-screen bg-[#F6F0FA]">
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Header (match dashboard style) */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4 rounded-2xl bg-white/80 px-5 py-3 backdrop-blur">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-purple-100/70">
            <UserStar className="h-5 w-5 text-purple-700" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-purple-700">
              Hi {greetingName} !
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center gap-2 rounded-2xl bg-white/80 px-5 py-3 text-purple-700 shadow-sm  hover:bg-white transition"
        >
          <LogOut className="h-4 w-4" />
          <span className="font-semibold">Log Out</span>
        </button>
      </header>

            {/* Page content */}
      <main className="mt-16 flex justify-center">
        <div className="w-full max-w-lg">
          {/* ONE card that contains: title + subtitle + form */}
          <div className="rounded-3xl bg-white/80 p-10 shadow-sm hover:bg-white transition backdrop-blur">
            <h1 className="text-3xl font-extrabold text-slate-900">
              Create Privileged User
            </h1>
            <p className="mt-2 text-slate-600">
              Add a Scientist or Admin to the BioCompute platform.
            </p>

            <form onSubmit={submit} className="mt-8 space-y-5">
              {/* Display Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Display Name
                </label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter Display Name"
                  className="w-full rounded-lg bg-white px-4 py-3 text-sm text-slate-900
                            ring-1 ring-slate-200/70 placeholder:text-slate-400
                            focus:outline-none focus:ring-2 focus:ring-purple-500/25
                            hover:ring-slate-300 transition"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Email
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="some@random.com"
                  className="w-full rounded-lg bg-white px-4 py-3 text-sm text-slate-900
                            ring-1 ring-slate-200/70 placeholder:text-slate-400
                            focus:outline-none focus:ring-2 focus:ring-purple-500/25
                            hover:ring-slate-300 transition"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Temporary Password
                </label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="Min 6 characters"
                  className="w-full rounded-lg bg-white px-4 py-3 text-sm text-slate-900
                            ring-1 ring-slate-200/70 placeholder:text-slate-400
                            focus:outline-none focus:ring-2 focus:ring-purple-500/25
                            hover:ring-slate-300 transition"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full rounded-lg bg-white px-4 py-3 text-sm text-slate-900
                            ring-1 ring-slate-200/70
                            focus:outline-none focus:ring-2 focus:ring-purple-500/25
                            hover:ring-slate-300 transition"
                >
                  <option value="scientist">Scientist</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {success}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-6">
                <button
                  type="button"
                  onClick={() => router.push("/admin/dashboard")}
                  className="rounded-lg bg-white/80 px-5 py-3 text-sm font-semibold text-slate-600 shadow-sm
                            hover:bg-white transition"
                >
                  Back to Dashboard
                </button>

                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-purple-700 shadow-sm ring-1 ring-purple-200 hover:bg-purple-500"
                >
                  <UserPlus className="h-4 w-4" />
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  </div>
);
}