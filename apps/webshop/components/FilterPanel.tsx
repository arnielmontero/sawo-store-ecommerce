"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

interface FilterPanelProps {
  minPrice: number;
  maxPrice: number;
}

// Price bounds are a fixed, generous range for a sauna-accessories catalog
// (a $6 timer up to a $1,000+ heater) — good enough for a first pass without
// querying the DB for the true min/max on every request.
const PRICE_FLOOR = 0;
const PRICE_CEIL = 150000;

export function FilterPanel({ minPrice, maxPrice }: FilterPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [localMin, setLocalMin] = useState(minPrice);
  const [localMax, setLocalMax] = useState(maxPrice);

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") params.delete(key);
    else params.set(key, value);
    router.push(`?${params.toString()}`, { scroll: false });
  }

  function applyPriceRange() {
    const params = new URLSearchParams(searchParams.toString());
    if (localMin > PRICE_FLOOR) params.set("minPrice", String(localMin * 100));
    else params.delete("minPrice");
    if (localMax < PRICE_CEIL) params.set("maxPrice", String(localMax * 100));
    else params.delete("maxPrice");
    router.push(`?${params.toString()}`, { scroll: false });
  }

  const inStockOnly = searchParams.get("inStock") === "1";
  const onSaleOnly = searchParams.get("onSale") === "1";

  return (
    <div className="flex flex-col gap-6 rounded-2xl bg-white p-5 shadow-card">
      <div>
        <h3 className="mb-3 font-serif text-base font-semibold text-ink-900">Filter by Price</h3>
        <div className="flex items-center gap-2 text-sm text-ink-700">
          <span>${localMin}</span>
          <span className="text-ink-300">—</span>
          <span>${localMax === PRICE_CEIL ? `${PRICE_CEIL / 100}+` : localMax}</span>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <input
            type="range"
            min={PRICE_FLOOR}
            max={PRICE_CEIL / 100}
            step={10}
            value={localMin}
            onChange={(e) => setLocalMin(Math.min(Number(e.target.value), localMax))}
            onMouseUp={applyPriceRange}
            onTouchEnd={applyPriceRange}
            className="accent-cedar-600"
          />
          <input
            type="range"
            min={PRICE_FLOOR}
            max={PRICE_CEIL / 100}
            step={10}
            value={localMax}
            onChange={(e) => setLocalMax(Math.max(Number(e.target.value), localMin))}
            onMouseUp={applyPriceRange}
            onTouchEnd={applyPriceRange}
            className="accent-cedar-600"
          />
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-serif text-base font-semibold text-ink-900">Availability</h3>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => updateParam("inStock", e.target.checked ? "1" : null)}
            className="rounded accent-cedar-600"
          />
          In Stock
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={onSaleOnly}
            onChange={(e) => updateParam("onSale", e.target.checked ? "1" : null)}
            className="rounded accent-cedar-600"
          />
          On Sale
        </label>
      </div>
    </div>
  );
}
