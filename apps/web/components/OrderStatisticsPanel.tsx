"use client";

import { useEffect, useState } from "react";
import { fetchOrderStatistics, type OrderStatistics } from "@/lib/api";
import { formatCents } from "@/lib/format";

export function OrderStatisticsPanel({ onClose }: { onClose: () => void }) {
  const [stats, setStats] = useState<OrderStatistics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrderStatistics()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load statistics."));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-ink-900">Order Statistics</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-500 hover:bg-gray-50 hover:text-ink-900"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {error ? (
          <p className="px-6 py-8 text-sm text-brand-600">{error}</p>
        ) : !stats ? (
          <p className="px-6 py-8 text-sm text-ink-500">Loading...</p>
        ) : (
          <div className="space-y-6 px-6 py-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-ink-100 p-4">
                <p className="text-xs uppercase tracking-wide text-ink-500">Total orders</p>
                <p className="mt-1 text-2xl font-semibold text-ink-900">{stats.totalOrders}</p>
              </div>
              <div className="rounded-xl border border-ink-100 p-4">
                <p className="text-xs uppercase tracking-wide text-ink-500">Revenue</p>
                <p className="mt-1 text-2xl font-semibold text-ink-900">{formatCents(stats.totalRevenueCents)}</p>
              </div>
              <div className="rounded-xl border border-ink-100 p-4">
                <p className="text-xs uppercase tracking-wide text-ink-500">Avg order value</p>
                <p className="mt-1 text-2xl font-semibold text-ink-900">{formatCents(stats.avgOrderValueCents)}</p>
              </div>
              <div className="rounded-xl border border-ink-100 p-4">
                <p className="text-xs uppercase tracking-wide text-ink-500">New clients</p>
                <p className="mt-1 text-2xl font-semibold text-ink-900">{stats.newClientCount}</p>
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-ink-900">Orders by status</p>
              <div className="space-y-2">
                {stats.countsByStatus.map(({ status, count }) => (
                  <div key={status} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs text-ink-500">{status}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: stats.totalOrders > 0 ? `${(count / stats.totalOrders) * 100}%` : "0%" }}
                      />
                    </div>
                    <span className="w-6 shrink-0 text-right text-xs font-medium text-ink-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-ink-500">
              Revenue counts PAID, SHIPPED, and DELIVERED orders only — PENDING orders haven&apos;t been paid yet,
              and CANCELLED/REFUNDED/RETURNED orders didn&apos;t result in kept revenue.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
