"use client";

import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink-900">Dashboard</h1>
      <p className="mt-1 text-sm text-ink-500">Welcome back, {user?.name}.</p>
    </div>
  );
}
