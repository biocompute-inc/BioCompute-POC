"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  if (loading) return <div style={{ padding: 16 }}>Loading...</div>;
  if (!user) return null;
  return <>{children}</>;
}

export function RequireRole({
  allowed,
  children,
}: {
  allowed: Array<"scientist" | "admin" | "user">;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !allowed.includes(user.role))) router.push("/dashboard");
  }, [loading, user, router, allowed]);

  if (loading) return <div style={{ padding: 16 }}>Loading...</div>;
  if (!user || !allowed.includes(user.role)) return null;
  return <>{children}</>;
}
