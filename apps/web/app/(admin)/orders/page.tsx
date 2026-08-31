"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchOrders, updateOrderStatus, type Order, type OrderStatus } from "@/lib/api";
import { formatCents, formatPaymentMethod } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { OrderRowMenu } from "@/components/OrderRowMenu";
import { OrderStatisticsPanel } from "@/components/OrderStatisticsPanel";
import { useAuth } from "@/lib/auth-context";

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statsOpen, setStatsOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders()
      .then(setOrders)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load orders."))
      .finally(() => setLoading(false));
  }, []);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return orders;
    return orders.filter(
      (order) =>
        order.reference.toLowerCase().includes(query) ||
        order.user?.email.toLowerCase().includes(query) ||
        order.status.toLowerCase().includes(query)
    );
  }, [orders, search]);

  const canAct = user?.role === "ADMIN" || user?.role === "FULFILLMENT_STAFF";

  async function handleTransition(orderId: number, status: OrderStatus) {
    setActionError(null);
    try {
      const updated = await updateOrderStatus(orderId, status);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: updated.status } : o)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update order status.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink-900">Orders</h1>
        <button
          onClick={() => setStatsOpen(true)}
          className="rounded-md border border-ink-100 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-gray-50"
        >
          Order Statistics
        </button>
      </div>

      {actionError && (
        <p className="mt-4 rounded-md bg-brand-50 px-4 py-2 text-sm text-brand-600">{actionError}</p>
      )}

      <div className="mt-6 rounded-xl border border-ink-100 bg-white">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <p className="text-sm font-medium text-ink-900">
            Orders ({filteredOrders.length}
            {filteredOrders.length !== orders.length ? ` of ${orders.length}` : ""})
          </p>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reference, customer, or status..."
            className="w-72 rounded-md border border-ink-100 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {error ? (
          <p className="px-5 py-8 text-center text-sm text-brand-600">{error}</p>
        ) : loading ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">Loading...</p>
        ) : filteredOrders.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">
            {orders.length === 0 ? "No orders yet." : "No orders match your search."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-3 font-medium">ID</th>
                  <th className="px-3 py-3 font-medium">Reference</th>
                  <th className="px-3 py-3 font-medium">Customer</th>
                  <th className="px-3 py-3 font-medium">New client?</th>
                  <th className="px-3 py-3 font-medium">Price</th>
                  <th className="px-3 py-3 font-medium">Payment</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="w-10 px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b border-ink-100 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3 text-ink-700">{order.id}</td>
                    <td className="px-3 py-3 font-medium text-ink-900">
                      <Link href={`/orders/${order.id}`} className="hover:text-brand-600 hover:underline">
                        {order.reference}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-700">{order.user?.email ?? "Guest"}</td>
                    <td className="px-3 py-3 text-ink-700">{order.isNewClient ? "Yes" : "No"}</td>
                    <td className="px-3 py-3 text-ink-700">
                      {formatCents(order.totalCents, order.currency)}
                    </td>
                    <td className="px-3 py-3 text-ink-700">
                      {formatPaymentMethod(order.paymentMethod)}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <OrderRowMenu order={order} canAct={canAct} onTransition={handleTransition} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {statsOpen && <OrderStatisticsPanel orders={orders} onClose={() => setStatsOpen(false)} />}
    </div>
  );
}
