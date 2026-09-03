"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TrackOrderForm({ initialValue }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue ?? "");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    router.push(`/track?ref=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. ORD-AB12CD"
        className="flex-1 rounded-xl border border-ink-100 px-4 py-3 text-sm uppercase tracking-wide placeholder:normal-case placeholder:tracking-normal focus:border-cedar-400 focus:outline-none"
      />
      <button
        type="submit"
        className="shrink-0 rounded-xl bg-cedar-600 px-6 py-3 text-sm font-semibold text-white hover:bg-cedar-700"
      >
        Track Order
      </button>
    </form>
  );
}
