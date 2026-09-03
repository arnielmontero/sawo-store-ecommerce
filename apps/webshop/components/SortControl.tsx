"use client";

import { useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  { value: "", label: "Featured" },
  { value: "createdAt-desc", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "name-asc", label: "Name: A to Z" },
] as const;

export function SortControl() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = `${searchParams.get("sortBy") ?? ""}${searchParams.get("sortBy") ? "-" : ""}${searchParams.get("sortDir") ?? ""}`;

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) {
      params.delete("sortBy");
      params.delete("sortDir");
    } else {
      const [sortBy, sortDir] = value.split("-");
      params.set("sortBy", sortBy);
      params.set("sortDir", sortDir);
    }
    router.push(`?${params.toString()}`, { scroll: false });
  }

  return (
    <label className="flex items-center gap-2 text-sm text-ink-700">
      <span className="hidden sm:inline">Sort by</span>
      <select
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-full border border-ink-100 bg-white px-3 py-2 text-sm text-ink-900 focus:border-cedar-400 focus:outline-none"
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
