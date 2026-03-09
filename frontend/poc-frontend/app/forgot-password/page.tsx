"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Dna, Mail, ArrowRight } from "lucide-react";
import DnaVaultImage from "@/app/assets/DnaVaultImage.png"
import Input from '@mui/joy/Input';
import Button from '@mui/joy/Button';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "${process.env.NEXT_PUBLIC_API_BASE}";

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
                  <label className="block text-lg font-bold text-slate-900 p-2">
                    Email
                  </label>
                    <Input
                      type="email"
                      value={email}
                      variant="soft"
                      color="neutral"
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      startDecorator={<Mail size={18} className="text-slate-400" />}
                      sx={{
                        "--Input-minHeight": "52px",          // overall pill height
                        "--Input-radius": "14px",             // pill rounding
                        "--Input-paddingInline": "14px",
                        "--Input-gap": "10px",
                        backgroundColor: "#EEF2F6",
                        boxShadow: "inset 0 0 0 1px #D0D7DE",
                        p: "6px",                                
                      }}
                      endDecorator={
                        <Button
                          type="submit"
                          variant="solid"
                          size = "sm"
                          disabled={state === "loading"}
                          sx={{
                            borderRadius: "24px",
                            px: 3,
                            height: "40px",
                            fontWeight: 600,
                            backgroundColor: email.trim()
                              ? "#7C3AED"
                              : "#E5E7EB",
                            color: email.trim()
                              ? "#ffffff"
                              : "#374151",
                            "&:hover": {
                              backgroundColor: email.trim()
                                ? "#6D28D9"
                                : "#E5E7EB",
                            },
                          }}
                        >
                          {state === "loading" ? "Sending…" : "Send Reset Link"}
                          <ArrowRight size={18} className="ml-1" />
                        </Button>
                      }
                    />
                  {error && (
                    <div className="mt-2 text-sm font-medium text-red-600">
                      {error}
                    </div>
                  )}
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
