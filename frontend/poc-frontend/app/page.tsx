"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Loading from "@/components/Loading";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/login");
    }, 5000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F3E8FF] flex flex-col">

      {/* Header */}
      <div className="pt-16 text-center px-6">
        <h1 className="text-3xl md:text-5xl font-semibold text-slate-900 tracking-tight">
          BioCompute Data Storage Platform
        </h1>
        <p className="mt-3 text-slate-600 text-sm md:text-base">
          Engineering the future of molecular data systems
        </p>
      </div>

      {/* Perfectly Centered Loading */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="flex-1 flex items-center justify-center">
          <Loading />
        </div>
      </div>

    </div>
  );
}