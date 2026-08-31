"use client";

import { useState } from "react";
import { bulkAdjustPrice, bulkSetActive, bulkSetCategory, type Category } from "@/lib/api";

export function CatalogBulkBar({
  selectedIds,
  categories,
  onDone,
  onClear,
}: {
  selectedIds: number[];
  categories: Category[];
  onDone: () => void;
  onClear: () => void;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceOpen, setPriceOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [percent, setPercent] = useState("");
  const [categoryId, setCategoryId] = useState("");

  async function run(action: () => Promise<void>) {
    setError(null);
    setWorking(true);
    try {
      await action();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk action failed.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="flex items-center justify-between border-b border-ink-100 bg-ink-900 px-5 py-3 text-white">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">{selectedIds.length} selected</span>
        {error && <span className="text-sm text-brand-300">{error}</span>}
      </div>
      <div className="flex items-center gap-2">
        <button
          disabled={working}
          onClick={() => run(() => bulkSetActive(selectedIds, true))}
          className="rounded-md border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-50"
        >
          Activate
        </button>
        <button
          disabled={working}
          onClick={() => run(() => bulkSetActive(selectedIds, false))}
          className="rounded-md border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-50"
        >
          Deactivate
        </button>

        <div className="relative">
          <button
            onClick={() => setCategoryOpen((v) => !v)}
            className="rounded-md border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10"
          >
            Set category
          </button>
          {categoryOpen && (
            <div className="absolute right-0 z-10 mt-1 w-56 rounded-md border border-ink-100 bg-white p-3 text-ink-900 shadow-lg">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-md border border-ink-100 px-2 py-1.5 text-sm"
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                disabled={working}
                onClick={() => {
                  setCategoryOpen(false);
                  run(() => bulkSetCategory(selectedIds, categoryId ? Number(categoryId) : null));
                }}
                className="mt-2 w-full rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setPriceOpen((v) => !v)}
            className="rounded-md border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10"
          >
            Adjust price %
          </button>
          {priceOpen && (
            <div className="absolute right-0 z-10 mt-1 w-56 rounded-md border border-ink-100 bg-white p-3 text-ink-900 shadow-lg">
              <input
                type="number"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                placeholder="-10 for 10% off"
                className="w-full rounded-md border border-ink-100 px-2 py-1.5 text-sm"
              />
              <button
                disabled={working || !percent}
                onClick={() => {
                  setPriceOpen(false);
                  run(() => bulkAdjustPrice(selectedIds, Number(percent)));
                }}
                className="mt-2 w-full rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        <button
          onClick={onClear}
          className="rounded-md px-3 py-1.5 text-sm text-white/70 hover:text-white"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
