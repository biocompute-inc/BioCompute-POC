"use client";

import DecryptedText from "@/components/DecryptedText";

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-black text-white">
      <div className="text-center">
        <DecryptedText
          text="Biocompute Digitizing your destiny"
          speed={40}
          maxIterations={15}
          sequential={true}
          revealDirection="center"
          animateOn="view"
          parentClassName="text-5xl md:text-7xl font-light tracking-wide"
          className="text-white"
          encryptedClassName="text-blue-500"
        />
      </div>
    </div>
  );
}