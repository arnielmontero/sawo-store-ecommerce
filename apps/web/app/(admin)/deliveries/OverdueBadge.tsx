import type { OverdueReason } from "@/lib/api";

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const hours = ms / (1000 * 60 * 60);
  if (hours < 48) return `${Math.floor(hours)}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Server decides isOverdue/overdueReason (see shipping.service.ts's
// computeOverdue) — this only renders the copy/color, never re-derives the
// threshold itself, so the badge can never disagree with the notification
// inbox's own stale-order alerts (both read the same thresholds).
export function OverdueBadge({
  reason,
  paidAt,
  updatedAt,
}: {
  reason: OverdueReason;
  paidAt: string | null;
  updatedAt: string;
}) {
  if (!reason) return null;

  const label =
    reason === "paid_too_long" ? `Overdue — paid ${relativeTime(paidAt)}` : `Overdue — shipped ${relativeTime(updatedAt)}`;

  return (
    <span className="ml-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
      {label}
    </span>
  );
}
