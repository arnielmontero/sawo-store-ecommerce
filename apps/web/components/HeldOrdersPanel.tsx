"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchHeldOrders, type HeldOrder } from "@/lib/api";
import { formatCents } from "@/lib/format";

export function HeldOrdersPanel({ onClose }: { onClose: () => void }) {
  const [orders, setOrders] = useState<HeldOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHeldOrders()
      .then(setOrders)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load held orders."));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">Held Orders</h2>
            <p className="mt-0.5 text-xs text-ink-500">
              Partially refunded — money has moved back to the customer, but the order isn&apos;t fully resolved.
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
          ) : !orders ? (
            <p className="text-sm text-ink-500">Loading...</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-ink-500">No orders are currently held.</p>
          ) : (
            <ul className="space-y-4">
              {orders.map((order) => (
                <li key={order.id} className="rounded-xl border border-ink-100 p-4">
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/orders/${order.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Opens in a new tab"
                      className="text-sm font-semibold text-ink-900 hover:text-brand-600 hover:underline"
                    >
                      {order.reference} <span className="text-ink-400">↗</span>
                    </Link>
                    <span className="text-xs text-ink-500">
                      {order.user?.email ?? "Guest"}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-ink-500">
                    <span>Refunded {formatCents(order.refundedCents, order.currency)}</span>
                    <span>Remaining {formatCents(order.remainingCents, order.currency)}</span>
                  </div>
                  <ul className="mt-3 space-y-1 border-t border-ink-100 pt-2">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex justify-between text-xs text-ink-700">
                        <span>
                          {item.productTitle} <span className="text-ink-400">({item.sku})</span>
                        </span>
                        <span>Qty {item.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
