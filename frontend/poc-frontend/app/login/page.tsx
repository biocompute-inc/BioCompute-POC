/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { refresh } = useAuth();
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await refresh();
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-[#E6E6FA]">
      {/* LEFT PANEL */}
      <div className="flex items-center justify-center px-8">
        <div className="w-full max-w-md">
          {/* Brand */}
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              BioCompute
            </h1>
            <p className="mt-2 text-sm text-purple-700 font-medium">
              Welcome back!
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Login to access the world of DNA Data Storage
            </p>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <div className="mt-1 text-right">
                <a
                  href="#"
                  className="text-xs font-medium text-purple-600 hover:underline"
                >
                  Forgot Password?
                </a>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="mt-2 w-full rounded-md bg-purple-600 py-2 text-sm font-semibold text-white hover:bg-purple-700 transition"
            >
              Login
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            Don’t have an account?{" "}
            <a
              href="/register"
              className="font-medium text-purple-600 hover:underline"
            >
              Sign Up
            </a>
          </p>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="hidden lg:flex items-center justify-center bg-[#EFE3F5]">
        <div className="relative h-[520px] w-[360px] rounded-xl overflow-hidden shadow-xl">
          <Image
                    className="dark:invert"
                    src="/next.svg"
                    alt="Next.js logo"
                    width={100}
                    height={20}
                    priority
                  />
        </div>
      </div>
    </div>
  );
}
