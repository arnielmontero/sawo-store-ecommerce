"use client";

import type { Order, OrderStatus } from "@/lib/api";
import { formatCents } from "@/lib/format";

const STATUS_ORDER: OrderStatus[] = [
  "PENDING",
  "PAID",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
  "RETURNED",
];

const REVENUE_STATUSES: OrderStatus[] = ["PAID", "SHIPPED", "DELIVERED"];

export function OrderStatisticsPanel({ orders, onClose }: { orders: Order[]; onClose: () => void }) {
  const totalOrders = orders.length;
  const revenueOrders = orders.filter((o) => REVENUE_STATUSES.includes(o.status));
  const totalRevenueCents = revenueOrders.reduce((sum, o) => sum + o.totalCents, 0);
  const avgOrderValueCents = revenueOrders.length > 0 ? Math.round(totalRevenueCents / revenueOrders.length) : 0;
  const newClientCount = orders.filter((o) => o.isNewClient).length;

  const countsByStatus = STATUS_ORDER.map((status) => ({
    status,
    count: orders.filter((o) => o.status === status).length,
  }));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-ink-900">Order Statistics</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-500 hover:bg-gray-50 hover:text-ink-900"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-ink-100 p-4">
              <p className="text-xs uppercase tracking-wide text-ink-500">Total orders</p>
              <p className="mt-1 text-2xl font-semibold text-ink-900">{totalOrders}</p>
            </div>
            <div className="rounded-xl border border-ink-100 p-4">
              <p className="text-xs uppercase tracking-wide text-ink-500">Revenue</p>
              <p className="mt-1 text-2xl font-semibold text-ink-900">{formatCents(totalRevenueCents)}</p>
            </div>
            <div className="rounded-xl border border-ink-100 p-4">
              <p className="text-xs uppercase tracking-wide text-ink-500">Avg order value</p>
              <p className="mt-1 text-2xl font-semibold text-ink-900">{formatCents(avgOrderValueCents)}</p>
            </div>
            <div className="rounded-xl border border-ink-100 p-4">
              <p className="text-xs uppercase tracking-wide text-ink-500">New clients</p>
              <p className="mt-1 text-2xl font-semibold text-ink-900">{newClientCount}</p>
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-medium text-ink-900">Orders by status</p>
            <div className="space-y-2">
              {countsByStatus.map(({ status, count }) => (
                <div key={status} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-xs text-ink-500">{status}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: totalOrders > 0 ? `${(count / totalOrders) * 100}%` : "0%" }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right text-xs font-medium text-ink-900">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-ink-500">
            Revenue counts PAID, SHIPPED, and DELIVERED orders only — PENDING orders haven&apos;t been paid yet,
            and CANCELLED/REFUNDED/RETURNED orders didn&apos;t result in kept revenue.
          </p>
        </div>
      </div>
    </div>
  );
}
