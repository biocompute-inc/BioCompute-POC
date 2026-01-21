/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api"; // Keep your existing imports
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { Dna, Eye, EyeOff, Lock, Mail } from "lucide-react";
import Link from "next/link"; // Better for Next.js navigation
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false); // Added loading state
  
  const { refresh } = useAuth();
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      
      const u = (await refresh()) as any;
      
      // Routing logic based on role
      if (u.role === "scientist") {
        router.push("/scientist/jobs");
      } else if (u.role === "admin") {
        router.push("/admin/dashboard");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-[#F5E6FA]">
      
      {/* LEFT PANEL (Form) */}
      <div className="flex flex-col justify-center px-8 py-12 lg:px-20 xl:px-24">
        <div className="w-full max-w-[440px] mx-auto">
          
          {/* Logo Section */}
          <div className="mb-10">
            <div className="flex items-center gap-3">
              {/* DNA Icon Container */}
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm border border-purple-100">
                <Dna className="h-5 w-5 text-purple-700" />
              </div>
              {/* Serif Font for Logo Match */}
              <span className="text-2xl font-serif tracking-widest text-slate-900 uppercase font-semibold">
                BioCompute
              </span>
            </div>
            
            <div className="mt-8 space-y-2">
              <h1 className="text-2xl font-bold text-purple-700">
                Welcome back!
              </h1>
              <p className="text-slate-500">
                Login to access the world of DNA Data Storage
              </p>
            </div>
          </div>

          {/* Form Section */}
          <form onSubmit={onSubmit} className="space-y-5">
            
            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-bold text-slate-700">
                Email
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  autoComplete="email"
                  required
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400
                            focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all"
                />
              </div>
            </div>
            {/* Password Field */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-bold text-slate-700">
                Password
              </label>
              <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-11 pr-11 text-sm text-slate-900 placeholder:text-slate-400
                              focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all"
                  />
                </div>
                <div className="flex justify-end">
                  <Link
                    href="/forgot-password"
                    className="text-xs font-bold text-purple-700 hover:text-purple-800 transition-colors"
                  >
                    Forgot Password?
                  </Link>
                </div>
              </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-red-600 flex items-center gap-2">
                <span>⚠️</span> {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-[#9D76C1] py-3 text-sm font-bold text-white shadow-sm hover:bg-[#8B64B0] focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-1 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? "Logging in..." : "Login"}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-sm text-slate-600">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-bold text-purple-700 hover:underline hover:text-purple-800"
            >
              Sign Up
            </Link>
          </p>
        </div>
      </div>

      {/* RIGHT PANEL (Image) */}
      {/* Using a darker, high-tech image to match the DNA Vault aesthetic */}
      <div className="hidden lg:block relative h-full w-full bg-black">
        <div className="absolute inset-0 bg-purple-900/20 z-10" /> {/* Overlay for tint */}
        <Image
          src="/next.svg"
          alt="DNA Data Storage Vault"
          width={100}
          height={20}
          className="h-full w-full object-cover opacity-90"
        />
        
        {/* Optional: Add the text overlay from the image if you want that detail */}
        <div className="absolute top-10 left-10 z-20">
             <div className="bg-black/50 backdrop-blur-md border border-white/10 p-4 rounded-xl text-white">
                <p className="text-xs uppercase tracking-widest text-purple-300">DNA Data Vault</p>
                <p className="text-xl font-bold">1 Yottabyte</p>
             </div>
        </div>
      </div>
      
    </div>
  );
}
