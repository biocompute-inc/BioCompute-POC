/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api"; // Keep your existing imports
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { Dna, Mail, Lock, LogIn} from "lucide-react";
import Link from "next/link"; // Better for Next.js navigation
import Image from "next/image";
import DnaVaultImage from "@/app/assets/DnaVaultImage.png"

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
    <div className="min-h-screen lg:h-screen grid grid-cols-1 lg:grid-cols-2 bg-[#F5E6FA] overflow-hidden">
      
      {/* LEFT PANEL (Form) */}
      <div className="flex flex-col justify-center px-8 py-6 lg:py-12 lg:px-20 xl:px-24">
        <div className="w-full max-w-440px mx-auto">
          
          {/* Logo Section */}
          <div className="mb-10">
            <div className="flex items-center gap-3">
              {/* DNA Icon Container */}
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm border border-purple-100">
                <Dna className="h-5 w-5 text-purple-700" />
              </div>
              {/* Serif Font for Logo Match */}
              <span className="text-4xl font-semibold tracking-tight text-slate-900">
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
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-gray-800 mb-3">
                Email
              </label>
              
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-white border border-gray-200 rounded-lg pl-12 pr-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent transition"
                  required
                />
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              </div>
            </div>
            {/* Password Field */}
              <div className="space-y-1.5">
                  <div className="flex items-center justify-between mb-3">
                    <label htmlFor="password" className="block text-sm font-bold text-gray-800">
                      Password
                    </label>
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white border border-gray-200 rounded-lg pl-12 pr-12 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent transition"
                      required
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
              className="w-full bg-[#9D76C1] hover:bg-[#8B5FBB] text-white font-bold py-3 px-4 rounded-lg transition duration-200 mt-8 inline-flex items-center justify-center gap-2"
            >
              <span>{isLoading ? "Logging in..." : "Login"}</span>
              <LogIn className="h-4 w-4" />
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
     
      <div className="hidden lg:flex items-center justify-center overflow-hidden">
        <Image
          src={DnaVaultImage}
          alt="DNA Data Storage Vault"
          width={380}
          height={200}
          //sizes="50vw"
          className="object-cover opacity-50 rounded-2xl"
          priority
        />
      </div> 
    </div>
  );
}
