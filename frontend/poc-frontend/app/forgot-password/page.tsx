"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Dna, Mail, ArrowRight } from "lucide-react";
import DnaVaultImage from "@/app/assets/DnaVaultImage.png"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const v = email.trim();
    if (!v) return setError("Please enter your email.");
    if (!v.includes("@")) return setError("Please enter a valid email.");

    setState("loading");
    try {
      await fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: v }),
      });
      setState("done");
    } catch {
      setError("Network error. Please try again.");
      setState("idle");
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

        {/* Two-column layout */}
        <div className="grid gap-4 lg:grid-cols-2 lg:items-center">
          {/* Left: form */}
          <div>
            <h2 className="text-3xl font-extrabold text-violet-700">
              Forgot password?
            </h2>
            <p className="mt-2 text-lg text-slate-500">
              Enter your email and we’ll send a secure reset link.
            </p>

            <div className="mt-8 rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-slate-200/70 backdrop-blur">
              {state === "done" ? (
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                  <div className="text-base font-bold text-violet-800">
                    Check your inbox
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    If an account exists for{" "}
                    <span className="font-semibold">{email.trim() || "that email"}</span>,
                    we sent a reset link.
                  </div>
                  <div className="mt-4 text-sm">
                    <Link
                      href="/login"
                      className="font-semibold text-violet-700 hover:underline"
                    >
                      Back to login
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={onSubmit}>
                  <label className="block text-lg font-bold text-slate-900">
                    Email
                  </label>

                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_0_0_1px_rgba(124,58,237,0.06)] focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-200">
                    <Mail className="h-5 w-5 text-slate-400" />
                    <input
                      className="w-full bg-transparent text-lg outline-none placeholder:text-slate-400"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                    />
                  </div>

                  {error && (
                    <div className="mt-2 text-sm font-medium text-red-600">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={state === "loading"}
                    className="mt-8 w-full rounded-xl bg-[#9B7BD2] px-2 py-2 text-xl font-extrabold text-white shadow-sm transition hover:brightness-[1.02] active:translate-y-1px disabled:opacity-70"
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      {state === "loading" ? "Sending…" : "Send reset link"}
                      <ArrowRight className="h-5 w-5" />
                    </span>
                  </button>

                  <div className="mt-6 text-center text-base text-slate-500">
                    Remembered it?{" "}
                    <Link
                      href="/login"
                      className="font-semibold text-violet-700 hover:underline"
                    >
                      Back to login
                    </Link>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Right: hero image (futuristic panel) */}
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
