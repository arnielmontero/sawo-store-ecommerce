"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchOrders, updateOrderStatus, refundPayment, exportOrdersCsvUrl, type Order, type OrderStatus } from "@/lib/api";
import { formatCents, formatPaymentMethod } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { OrderRowMenu } from "@/components/OrderRowMenu";
import { OrderStatisticsPanel } from "@/components/OrderStatisticsPanel";
import { HeldOrdersPanel } from "@/components/HeldOrdersPanel";
import { useAuth } from "@/lib/auth-context";
import { useStoreSettings } from "@/lib/store-settings-context";

const STATUS_OPTIONS: OrderStatus[] = [
  "PENDING",
  "PAID",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "RETURNED",
];

export default function OrdersPage() {
  const { user } = useAuth();
  const { settings } = useStoreSettings();
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Debounce the search box so every keystroke doesn't fire a request.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  function load() {
    setLoading(true);
    fetchOrders({
      search: search || undefined,
      status: statusFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page,
    })
      .then((result) => {
        setOrders(result.orders);
        setPagination(result.pagination);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load orders."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [search, statusFilter, dateFrom, dateTo, page]);

  const hasFilters = Boolean(search || statusFilter || dateFrom || dateTo);

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  const canAct = user?.role === "ADMIN" || user?.role === "FULFILLMENT_STAFF";

  async function handleTransition(orderId: number, status: OrderStatus) {
    setActionError(null);
    try {
      // REFUNDED must go through the payments endpoint, which actually
      // calls Stripe to move money back to the customer before flipping the
      // order's status — the generic status PATCH only flips the status.
      const updated =
        status === "REFUNDED" ? await refundPayment(orderId) : await updateOrderStatus(orderId, status);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: updated.status } : o)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update order status.");
    }
  }

  async function handleExport() {
    const url = await exportOrdersCsvUrl({
      search: search || undefined,
      status: statusFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
    const a = document.createElement("a");
    a.href = url;
    a.download = "orders-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink-900">Orders</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="rounded-md border border-ink-100 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-gray-50"
          >
            Export CSV
          </button>
          {settings?.allowPartialRefunds && (
            <button
              onClick={() => setHeldOpen(true)}
              className="rounded-md border border-ink-100 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-gray-50"
            >
              Held Orders
            </button>
          )}
          <button
            onClick={() => setStatsOpen(true)}
            className="rounded-md border border-ink-100 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-gray-50"
          >
            Order Statistics
          </button>
        </div>
      </div>

      {actionError && (
        <p className="mt-4 rounded-md bg-brand-50 px-4 py-2 text-sm text-brand-600">{actionError}</p>
      )}

      <div className="mt-6 rounded-xl border border-ink-100 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
          <p className="text-sm font-medium text-ink-900">
            Orders ({pagination.total})
          </p>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by reference or customer email..."
            className="w-72 rounded-md border border-ink-100 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-5 py-3">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as OrderStatus | "");
              setPage(1);
            }}
            className="rounded-md border border-ink-100 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1.5 text-sm text-ink-500">
            <span>From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-ink-100 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
            />
            <span>to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-ink-100 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
            />
          </div>
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
        ) : orders.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">
            {hasFilters ? "No orders match your filters." : "No orders yet."}
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
                {orders.map((order) => (
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

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-ink-100 px-5 py-4">
            <p className="text-xs text-ink-500">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} orders)
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

      {statsOpen && <OrderStatisticsPanel onClose={() => setStatsOpen(false)} />}
      {heldOpen && <HeldOrdersPanel onClose={() => setHeldOpen(false)} />}
    </div>
  );
}
