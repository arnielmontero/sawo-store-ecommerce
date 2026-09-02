"use client";

import { useEffect, useState } from "react";
import { fetchShipmentStatistics, type ShipmentStatistics } from "@/lib/api";

function formatDuration(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

// Inline (not a slide-over, unlike OrderStatisticsPanel) — delivery health
// is the primary reason someone opens this page, so it shouldn't be hidden
// behind a click. Fetched once on mount; counts are tab-independent totals
// across the whole table, matching getShipmentStatistics's design.
export function DeliveryStatsBar() {
  const [stats, setStats] = useState<ShipmentStatistics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchShipmentStatistics()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load delivery statistics."));
  }, []);

  if (error) return null;

  return (
    <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="rounded-xl border border-ink-100 bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-ink-500">Pending</p>
        <p className="mt-1 text-2xl font-semibold text-ink-900">{stats?.pendingCount ?? "—"}</p>
      </div>
      <div className="rounded-xl border border-ink-100 bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-ink-500">In transit</p>
        <p className="mt-1 text-2xl font-semibold text-ink-900">{stats?.inTransitCount ?? "—"}</p>
      </div>
      <div className="rounded-xl border border-ink-100 bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-ink-500">Delivered (7d)</p>
        <p className="mt-1 text-2xl font-semibold text-ink-900">{stats?.deliveredThisWeekCount ?? "—"}</p>
      </div>
      <div className="rounded-xl border border-ink-100 bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-ink-500">Avg time to ship</p>
        <p className="mt-1 text-2xl font-semibold text-ink-900">{formatDuration(stats?.avgPaidToShipHours ?? null)}</p>
      </div>
    </div>
  );
}
