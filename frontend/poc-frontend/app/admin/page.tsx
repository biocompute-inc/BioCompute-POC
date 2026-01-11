/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { RequireRole } from "@/components/RequireAuth";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

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
      setError(err.message);
    }
  }
  const { user, logout } = useAuth();

    const greetingName = useMemo(() => {
      return  user?.display_name || user?.email || "User";
    }, [ user]);

  return (
    <>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F4ECF7" }}>
        <h1>Hi, {greetingName}!</h1>
        <button onClick={logout}>Log Out</button>
    </div>
    <div className="min-h-screen bg-[#F4ECF7] flex items-center justify-center px-6">
      <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">
          Create Privileged User
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          Add a Scientist or Admin to the BioCompute platform.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Display Name
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter Display Name"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="some@random.com"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Temporary Password
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Min 6 characters"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
            >
              <option value="scientist">Scientist</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {success}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="submit"
              className="rounded-md bg-purple-600 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-700 hover:underline"
            >
              Create User
            </button>

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="text-sm text-slate-500 hover:underline"
            >
              Back to Dashboard
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}
