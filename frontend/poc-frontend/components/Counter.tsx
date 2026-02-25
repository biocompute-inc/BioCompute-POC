"use client";

import { useEffect, useState } from "react";

interface CounterProps {
  value: number;
  duration?: number; // ms
  formatter?: (val: number) => string;
}

export default function Counter({
  value,
  duration = 1000,
  formatter,
}: CounterProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const increment = value / (duration / 16); // ~60fps
    const timer = setInterval(() => {
      start += increment;

      if (start >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value, duration]);

  return <>{formatter ? formatter(count) : count}</>;
}