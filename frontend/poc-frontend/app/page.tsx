"use client";

import Link from "next/link";
import Image from "next/image";
import DnaVaultImage from "@/app/assets/DeviceEditedFinalNoBG.png";

export default function Home() {
  return (
    <div
      className="relative h-screen w-screen overflow-hidden flex flex-col"
      style={{ background: "#F5E6FA" }}
    >
      {/* ── Navbar ── */}
      <nav className="relative z-10 flex items-center justify-between px-8 md:px-16 pt-7">
        <span className="text-lg font-bold tracking-widest uppercase text-black select-none">
          Mo by BioCompute<span></span>
        </span>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="px-5 py-2 text-sm font-medium text-black border border-black/30 rounded-full hover:bg-black/10 transition-all duration-200"
          >
            Log In
          </Link>
          <Link
            href="/register"
            className="px-5 py-2 text-sm font-semibold text-black rounded-full border border-black/60 bg-black/5 hover:bg-black/15 transition-all duration-200"
          >
            Sign Up
          </Link>
        </div>
      </nav>

      {/* ── Hero Content ── */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-6">
        <div className="flex flex-col md:flex-row items-center gap-12 max-w-6xl w-full">

          {/* Left: Text block */}
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-5xl md:text-7xl font-extrabold leading-[1.05] tracking-tight text-black">
              The Future of{" "}
              <span className="text-black">
                Secure Data is DNA
              </span>
            </h1>

            <p className="mt-6 text-base md:text-lg text-black/70 max-w-lg leading-relaxed">
              Mo by BioCompute is a DNA Data Storage Platform powered by BioCompute.
            </p>

            {/* CTA buttons */}
            <div className="mt-10 flex flex-wrap gap-4 justify-center md:justify-start">
              <Link
                href="/register"
                className="px-8 py-3.5 text-sm font-bold text-black rounded-full border-2 border-black transition-all duration-300 hover:scale-105 hover:bg-black/10"
              >
                Get Started Free
              </Link>
              <Link
                href="/login"
                className="px-8 py-3.5 text-sm font-semibold text-black rounded-full border border-black/40 hover:bg-black/10 transition-all duration-300 hover:scale-105"
              >
                Login →
              </Link>
            </div>

            {/* Social proof strip */}

          </div>

          {/* Right: Device image */}
          <div className="flex-shrink-0 relative flex items-center justify-center w-72 md:w-[380px]">
            <Image
              src={DnaVaultImage}
              alt="DNA Vault Device"
              className="relative z-10 drop-shadow-2xl animate-float w-full"
              priority
            />
          </div>
        </div>
      </div>

      {/* ── Footer strip ── */}
      <div className="relative z-10 pb-5 text-center">
        <p className="text-[11px] text-black/40 tracking-widest uppercase">
          © 2026 BioCompute Inc. &nbsp;·&nbsp; Mo by BioCompute Platform
        </p>
      </div>
    </div>
  );
}