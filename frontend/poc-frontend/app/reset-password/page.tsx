"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Dna, Lock, ArrowRight, TriangleAlert } from "lucide-react";
import DnaVaultImage from "@/app/assets/DnaVaultImage.png"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";


export default function ResetPasswordPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = useMemo(() => params.get("token") ?? "", [params]);

  const [status, setStatus] = useState<"checking" | "invalid" | "ready" | "saving" | "done">("checking");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function validate() {
      if (!token) {
        setStatus("invalid");
        return;
      }
      setStatus("checking");
      try {
        const res = await fetch(`${API_BASE}/auth/reset-password/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const j = await res.json();
        if (!cancelled) setStatus(j.ok ? "ready" : "invalid");
      } catch {
        if (!cancelled) setStatus("invalid");
      }
    }

    validate();
    return () => { cancelled = true; };
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) return setError("Missing token.");
    if (pw.length < 6) return setError("Password must be at least 6 characters.");
    if (pw.length > 24) return setError("Password must be at most 24 characters.");
    if (pw !== pw2) return setError("Passwords do not match.");


    setStatus("saving");
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: pw }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.detail ?? "Reset failed.");
        setStatus("ready");
        return;
      }

      setStatus("done");
      setTimeout(() => router.push("/login"), 900);
    } catch {
      setError("Network error. Please try again.");
      setStatus("ready");
    }
  }

  return (
    <div className="min-h-screen bg-[#F3E6F9] px-6 py-10">
      <div className="mx-auto w-full max-w-7xl">
        {/* Brand row */}
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm">
            <Dna className="h-5 w-5 text-violet-700" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
            BioCompute
          </h1>
        </div>

        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          {/* Left */}
          <div>
            <h2 className="text-4xl font-extrabold text-violet-700">
              Reset password
            </h2>
            <p className="mt-2 text-lg text-slate-500">
              Choose a new password to access your account.
            </p>

            <div className="mt-8 rounded-2xl bg-white/70 p-8 shadow-sm ring-1 ring-slate-200/70 backdrop-blur">
              {status === "checking" && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Validating your link…
                </div>
              )}

              {status === "invalid" && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="flex items-center gap-2 text-base font-bold text-red-700">
                    <TriangleAlert className="h-5 w-5" />
                    Link is invalid or expired
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    Please request a new reset link.
                  </div>
                  <div className="mt-4 text-sm">
                    <Link href="/forgot-password" className="font-semibold text-violet-700 hover:underline">
                      Go to Forgot password
                    </Link>
                  </div>
                </div>
              )}

              {status === "ready" && (
                <form onSubmit={onSubmit}>
                  <label className="block text-lg font-bold text-slate-900">
                    New password
                  </label>
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_0_0_1px_rgba(124,58,237,0.06)] focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-200">
                    <Lock className="h-5 w-5 text-slate-400" />
                    <input
                      className="w-full bg-transparent text-lg outline-none placeholder:text-slate-400"
                      type="password"
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                      placeholder="6–24 characters"
                      autoComplete="new-password"
                      required
                    />
                  </div>

                  <label className="mt-6 block text-lg font-bold text-slate-900">
                    Confirm password
                  </label>
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_0_0_1px_rgba(124,58,237,0.06)] focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-200">
                    <Lock className="h-5 w-5 text-slate-400" />
                    <input
                      className="w-full bg-transparent text-lg outline-none placeholder:text-slate-400"
                      type="password"
                      value={pw2}
                      onChange={(e) => setPw2(e.target.value)}
                      placeholder="Repeat password"
                      autoComplete="new-password"
                      required
                    />
                  </div>

                  {error && (
                    <div className="mt-3 text-sm font-medium text-red-600">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    //disabled={status === "saving"}
                    className="mt-8 w-full rounded-xl bg-[#9B7BD2] px-5 py-4 text-xl font-extrabold text-white shadow-sm transition hover:brightness-[1.02] active:translate-y-1px disabled:opacity-70"
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      {/* {status === "saving" ? "Saving…" : "Update password"} */}
                      <ArrowRight className="h-5 w-5" />
                    </span>
                  </button>

                  <div className="mt-6 text-center text-base text-slate-500">
                    Back to{" "}
                    <Link href="/login" className="font-semibold text-violet-700 hover:underline">
                      login
                    </Link>
                  </div>
                </form>
              )}

              {status === "done" && (
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                  <div className="text-base font-bold text-violet-800">
                    Password updated
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    Redirecting to login…
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right hero */}
            <div className="hidden lg:flex items-center justify-center overflow-hidden">
                <Image
                src={DnaVaultImage}
                alt="DNA Data Storage Vault"
                width={360}
                height={200}
                className="object-cover rounded-2xl"
                priority
                />
            </div> 
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          Tip: reset links expire automatically for safety.
        </p>
      </div>
    </div>
  );
}
