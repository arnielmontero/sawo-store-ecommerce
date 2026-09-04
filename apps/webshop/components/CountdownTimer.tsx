"use client";

import { useEffect, useState } from "react";

function getRemaining(target: number) {
  const diffMs = target - Date.now();
  if (diffMs <= 0) return null;
  const totalSeconds = Math.floor(diffMs / 1000);
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// Only ever counts down to a REAL Product.saleEndsAt set by an admin — this
// component is never handed a fabricated deadline. A product on sale with
// no end date renders no countdown at all (see FlashDealsRail), same
// "don't invent urgency" principle as the rest of this storefront's data.
export function CountdownTimer({ endsAt, className = "" }: { endsAt: string; className?: string }) {
  const target = new Date(endsAt).getTime();
  const [remaining, setRemaining] = useState(() => getRemaining(target));

  useEffect(() => {
    const interval = setInterval(() => setRemaining(getRemaining(target)), 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (!remaining) return null;

  return (
    <div className={`flex items-center gap-1 font-mono text-xs font-semibold ${className}`} role="timer">
      <span className="rounded bg-ink-900 px-1.5 py-0.5 text-white">{pad(remaining.hours)}</span>
      <span>:</span>
      <span className="rounded bg-ink-900 px-1.5 py-0.5 text-white">{pad(remaining.minutes)}</span>
      <span>:</span>
      <span className="rounded bg-ink-900 px-1.5 py-0.5 text-white">{pad(remaining.seconds)}</span>
    </div>
  );
}
