"use client";
import {motion} from 'framer-motion';
export default function Loading() {
  return (
   
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200">
      <div className="flex flex-col items-center gap-6 p-10 bg-white shadow-xl rounded-2xl">
        {/* Spinner */}
        <motion.div
          className="w-16 h-16 border-4 border-slate-300 border-t-slate-900 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        />

        {/* Loading Text */}
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-800">Loading</h1>
          <p className="text-sm text-slate-500 mt-1">
            Please wait while we prepare your experience
          </p>
        </div>

        {/* Animated Dots */}
        <div className="flex gap-2">
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              className="w-3 h-3 bg-slate-900 rounded-full"
              animate={{ y: [0, -6, 0] }}
              transition={{
                repeat: Infinity,
                duration: 0.6,
                delay: index * 0.2,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}