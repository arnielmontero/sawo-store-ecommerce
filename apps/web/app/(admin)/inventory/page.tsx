"use client";

import { useEffect, useState } from "react";
import {
  fetchInventory,
  fetchInventorySummary,
  type InventoryRow,
  type InventorySummary,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { hasPermission } from "@/lib/permissions";
import { AdjustStockModal } from "@/components/AdjustStockModal";
import { StockHistoryPanel } from "@/components/StockHistoryPanel";

type StockFilter = "" | "low" | "out";

export default function InventoryPage() {
  const { user } = useAuth();
  const canAdjust = hasPermission(user, "inventory", "adjustStock");

  const [variants, setVariants] = useState<InventoryRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [adjusting, setAdjusting] = useState<InventoryRow | null>(null);
  const [historyFor, setHistoryFor] = useState<InventoryRow | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  function loadSummary() {
    fetchInventorySummary().then(setSummary).catch(() => {});
  }

  function load() {
    setLoading(true);
    fetchInventory({ search: search || undefined, stockFilter: stockFilter || undefined, page, sortDir })
      .then((result) => {
        setVariants(result.variants);
        setPagination(result.pagination);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load inventory."))
      .finally(() => setLoading(false));
  }

  useEffect(loadSummary, []);
  useEffect(load, [search, stockFilter, sortDir, page]);

  function refreshAfterAdjust() {
    load();
    loadSummary();
  }

  const hasFilters = Boolean(search || stockFilter);

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setStockFilter("");
    setPage(1);
  }

  function formatAttributes(attributes: Record<string, string> | null) {
    if (!attributes) return "—";
    return Object.entries(attributes)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink-900">Inventory</h1>
      </div>

      {summary && (
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-ink-100 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Total variants</p>
            <p className="mt-1 text-2xl font-semibold text-ink-900">{summary.totalVariants}</p>
          </div>
          <div className="rounded-xl border border-ink-100 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Low stock</p>
            <p className="mt-1 text-2xl font-semibold text-amber-600">{summary.lowStock}</p>
          </div>
          <div className="rounded-xl border border-ink-100 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Out of stock</p>
            <p className="mt-1 text-2xl font-semibold text-brand-600">{summary.outOfStock}</p>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-ink-100 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
          <p className="text-sm font-medium text-ink-900">Stock ({pagination.total})</p>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by SKU or product name..."
            className="w-72 rounded-md border border-ink-100 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-5 py-3">
          <select
            value={stockFilter}
            onChange={(e) => {
              setStockFilter(e.target.value as StockFilter);
              setPage(1);
            }}
            className="rounded-md border border-ink-100 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All stock levels</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </select>
          <select
            value={sortDir}
            onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
            className="rounded-md border border-ink-100 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
          >
            <option value="asc">Stock: lowest first</option>
            <option value="desc">Stock: highest first</option>
          </select>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-500 hover:bg-gray-50 hover:text-ink-900"
            >
              Clear filters
            </button>
          )}
        </div>

        {error ? (
          <p className="px-5 py-8 text-center text-sm text-brand-600">{error}</p>
        ) : loading ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">Loading...</p>
        ) : variants.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">
            {hasFilters ? "No variants match your filters." : "No variants yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-3 py-3 font-medium">SKU</th>
                  <th className="px-3 py-3 font-medium">Category</th>
                  <th className="px-3 py-3 font-medium">Attributes</th>
                  <th className="px-3 py-3 font-medium">Stock</th>
                  <th className="px-3 py-3 font-medium">Reserved</th>
                  <th className="px-3 py-3 font-medium">Available</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.variantId} className="border-b border-ink-100 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-ink-900">{v.productTitle}</td>
                    <td className="px-3 py-3 font-mono text-xs text-ink-700">{v.sku}</td>
                    <td className="px-3 py-3 text-ink-700">{v.categoryName ?? "—"}</td>
                    <td className="px-3 py-3 text-ink-700">{formatAttributes(v.attributes)}</td>
                    <td className="px-3 py-3">
                      <span
                        className={
                          v.isOutOfStock
                            ? "font-medium text-brand-600"
                            : v.isLowStock
                              ? "font-medium text-amber-600"
                              : "text-ink-700"
                        }
                      >
                        {v.stockQuantity}
                      </span>
                      {v.isOutOfStock && (
                        <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600">
                          Out of stock
                        </span>
                      )}
                      {!v.isOutOfStock && v.isLowStock && (
                        <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
                          Low
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-ink-500">{v.reservedQuantity}</td>
                    <td className="px-3 py-3 text-ink-700">{v.availableQuantity}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setHistoryFor(v)}
                          className="rounded-md px-2 py-1 text-xs font-medium text-ink-600 hover:bg-gray-50"
                        >
                          History
                        </button>
                        {canAdjust && (
                          <button
                            onClick={() => setAdjusting(v)}
                            className="rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
                          >
                            Adjust
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-ink-100 px-5 py-4">
            <p className="text-xs text-ink-500">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} variants)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {adjusting && (
        <AdjustStockModal
          variant={adjusting}
          onClose={() => setAdjusting(null)}
          onAdjusted={() => {
            setAdjusting(null);
            refreshAfterAdjust();
          }}
        />
      )}

      {historyFor && <StockHistoryPanel variant={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}
