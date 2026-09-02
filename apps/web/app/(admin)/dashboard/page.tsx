"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchOrderStatistics,
  fetchTopProducts,
  fetchInventorySummary,
  fetchShipmentStatistics,
  fetchNotifications,
  type OrderStatistics,
  type TopProduct,
  type InventorySummary,
  type ShipmentStatistics,
  type OrderStatus,
} from "@/lib/api";
import { formatCents } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";

// Status colors follow the app's existing ad hoc semantic convention (see
// Inventory/Coupons pages) rather than a full categorical palette — a small
// internal ops dashboard, not a data product. Grouped roughly by what stage
// of the order lifecycle each status represents.
const STATUS_META: Record<OrderStatus, { label: string; barClass: string }> = {
  PENDING: { label: "Pending", barClass: "bg-amber-400" },
  PAID: { label: "Paid", barClass: "bg-blue-500" },
  SHIPPED: { label: "Shipped", barClass: "bg-indigo-500" },
  DELIVERED: { label: "Delivered", barClass: "bg-green-500" },
  CANCELLED: { label: "Cancelled", barClass: "bg-gray-400" },
  REFUNDED: { label: "Refunded", barClass: "bg-red-500" },
  RETURNED: { label: "Returned", barClass: "bg-orange-500" },
  PARTIALLY_REFUNDED: { label: "Partially refunded", barClass: "bg-red-300" },
};

function StatTile({ label, value, tone }: { label: string; value: string; tone?: "warn" | "danger" }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          tone === "danger" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-ink-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  const [stats, setStats] = useState<OrderStatistics | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [inventory, setInventory] = useState<InventorySummary | null>(null);
  const [shipments, setShipments] = useState<ShipmentStatistics | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchOrderStatistics(),
      fetchTopProducts(5),
      fetchInventorySummary(),
      fetchShipmentStatistics(),
      fetchNotifications({ unreadOnly: true }),
    ])
      .then(([orderStats, products, inv, ship, notifications]) => {
        setStats(orderStats);
        setTopProducts(products);
        setInventory(inv);
        setShipments(ship);
        setUnreadCount(notifications.unreadCount);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const maxStatusCount = stats ? Math.max(1, ...stats.countsByStatus.map((s) => s.count)) : 1;
  const maxProductRevenue = topProducts.length > 0 ? Math.max(...topProducts.map((p) => p.revenueCents)) : 1;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink-900">Dashboard</h1>
      <p className="mt-1 text-sm text-ink-500">Welcome back, {user?.name}.</p>

      {loading ? (
        <p className="mt-6 text-sm text-ink-500">Loading...</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Total revenue" value={formatCents(stats?.totalRevenueCents ?? 0)} />
            <StatTile label="Total orders" value={String(stats?.totalOrders ?? 0)} />
            <StatTile label="Avg. order value" value={formatCents(stats?.avgOrderValueCents ?? 0)} />
            <StatTile label="New customers" value={String(stats?.newClientCount ?? 0)} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Link href="/notifications">
              <StatTile label="Unread notifications" value={String(unreadCount)} tone={unreadCount > 0 ? "warn" : undefined} />
            </Link>
            <Link href="/inventory">
              <StatTile label="Low stock" value={String(inventory?.lowStock ?? 0)} tone={inventory && inventory.lowStock > 0 ? "warn" : undefined} />
            </Link>
            <Link href="/inventory">
              <StatTile label="Out of stock" value={String(inventory?.outOfStock ?? 0)} tone={inventory && inventory.outOfStock > 0 ? "danger" : undefined} />
            </Link>
            <Link href="/deliveries">
              <StatTile label="Pending shipment" value={String(shipments?.pendingCount ?? 0)} />
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-ink-100 bg-white p-5">
              <p className="text-sm font-medium text-ink-900">Orders by status</p>
              <div className="mt-4 space-y-2.5">
                {stats?.countsByStatus
                  .filter((s) => s.count > 0)
                  .map((s) => {
                    const meta = STATUS_META[s.status];
                    return (
                      <div key={s.status} className="flex items-center gap-3 text-sm">
                        <span className="w-36 shrink-0 text-ink-600">{meta.label}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full ${meta.barClass}`}
                            style={{ width: `${Math.max(4, (s.count / maxStatusCount) * 100)}%` }}
                          />
                        </div>
                        <span className="w-10 shrink-0 text-right font-medium text-ink-900">{s.count}</span>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="rounded-xl border border-ink-100 bg-white p-5">
              <p className="text-sm font-medium text-ink-900">Top products</p>
              {topProducts.length === 0 ? (
                <p className="mt-4 text-sm text-ink-400">No completed sales yet.</p>
              ) : (
                <div className="mt-4 space-y-2.5">
                  {topProducts.map((p) => (
                    <div key={p.productId} className="flex items-center gap-3 text-sm">
                      <span className="w-36 shrink-0 truncate text-ink-600" title={p.title}>
                        {p.title}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${Math.max(4, (p.revenueCents / maxProductRevenue) * 100)}%` }}
                        />
                      </div>
                      <span className="w-20 shrink-0 text-right font-medium text-ink-900">{formatCents(p.revenueCents)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
