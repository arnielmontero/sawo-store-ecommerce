"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchStockAdjustmentHistory, type InventoryRow, type StockAdjustment } from "@/lib/api";

const REASON_LABELS: Record<StockAdjustment["reason"], string> = {
  MANUAL: "Manual adjustment",
  ORDER_SALE: "Order sale",
  ORDER_RETURN: "Order returned",
  REFUND_RESTOCK: "Refund restock",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function StockHistoryPanel({ variant, onClose }: { variant: InventoryRow; onClose: () => void }) {
  const [adjustments, setAdjustments] = useState<StockAdjustment[] | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStockAdjustmentHistory(variant.variantId, page)
      .then((result) => {
        setAdjustments(result.adjustments);
        setPagination(result.pagination);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load stock history."));
  }, [variant.variantId, page]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">Stock history</h2>
            <p className="mt-0.5 text-xs text-ink-500">
              {variant.productTitle} <span className="font-mono">({variant.sku})</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-500 hover:bg-gray-50 hover:text-ink-900"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-6">
          {error ? (
            <p className="text-sm text-brand-600">{error}</p>
          ) : !adjustments ? (
            <p className="text-sm text-ink-500">Loading...</p>
          ) : adjustments.length === 0 ? (
            <p className="text-sm text-ink-500">No stock changes recorded for this variant yet.</p>
          ) : (
            <ul className="space-y-3">
              {adjustments.map((adj) => (
                <li key={adj.id} className="rounded-xl border border-ink-100 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink-900">{REASON_LABELS[adj.reason]}</span>
                    <span className={`text-sm font-semibold ${adj.deltaQuantity >= 0 ? "text-emerald-600" : "text-brand-600"}`}>
                      {adj.deltaQuantity >= 0 ? "+" : ""}
                      {adj.deltaQuantity}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {formatDateTime(adj.createdAt)} · resulting stock {adj.resultingQuantity}
                  </p>
                  {adj.orderReference && (
                    <p className="mt-1 text-xs text-ink-500">
                      Order{" "}
                      {adj.orderId ? (
                        <Link
                          href={`/orders/${adj.orderId}`}
                          className="font-mono text-brand-600 hover:underline"
                        >
                          {adj.orderReference}
                        </Link>
                      ) : (
                        <span className="font-mono">{adj.orderReference}</span>
                      )}
                    </p>
                  )}
                  {adj.adminName && <p className="mt-1 text-xs text-ink-500">By {adj.adminName}</p>}
                  {adj.note && <p className="mt-2 text-sm text-ink-700">{adj.note}</p>}
                </li>
              ))}
            </ul>
          )}

          {pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-ink-500">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1}
                  className="rounded-md border border-ink-100 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="rounded-md border border-ink-100 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
