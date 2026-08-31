"use client";

import { useEffect, useState } from "react";
import { fetchPendingShipments, shipOrder, type PendingShipment } from "@/lib/api";
import { formatCents } from "@/lib/format";

export default function DeliveriesPage() {
  const [orders, setOrders] = useState<PendingShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trackingInputs, setTrackingInputs] = useState<Record<number, string>>({});
  const [shippingId, setShippingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetchPendingShipments()
      .then(setOrders)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load deliveries."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleShip(orderId: number) {
    const trackingNumber = trackingInputs[orderId]?.trim();
    if (!trackingNumber) {
      setActionError("Enter a tracking number before marking as shipped.");
      return;
    }
    setActionError(null);
    setShippingId(orderId);
    try {
      await shipOrder(orderId, trackingNumber);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to mark order as shipped.");
    } finally {
      setShippingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink-900">Deliveries</h1>
      </div>
      <p className="mt-1 text-sm text-ink-500">Orders that are paid and waiting to be shipped.</p>

      {actionError && (
        <p className="mt-4 rounded-md bg-brand-50 px-4 py-2 text-sm text-brand-600">{actionError}</p>
      )}

      <div className="mt-6 rounded-xl border border-ink-100 bg-white">
        <div className="border-b border-ink-100 px-5 py-4">
          <p className="text-sm font-medium text-ink-900">Pending delivery ({orders.length})</p>
        </div>

        {error ? (
          <p className="px-5 py-8 text-center text-sm text-brand-600">{error}</p>
        ) : loading ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">Loading...</p>
        ) : orders.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">Nothing awaiting delivery.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-3 font-medium">Reference</th>
                  <th className="px-3 py-3 font-medium">Items</th>
                  <th className="px-3 py-3 font-medium">Total</th>
                  <th className="px-3 py-3 font-medium">Ordered</th>
                  <th className="px-3 py-3 font-medium">Tracking number</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-ink-100 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-ink-900">{order.reference}</td>
                    <td className="px-3 py-3 text-ink-700">
                      {order.items.reduce((sum, item) => sum + item.quantity, 0)}
                    </td>
                    <td className="px-3 py-3 text-ink-700">
                      {formatCents(order.totalCents, order.currency)}
                    </td>
                    <td className="px-3 py-3 text-ink-700">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        placeholder="e.g. 1Z999AA10123456784"
                        value={trackingInputs[order.id] ?? ""}
                        onChange={(e) =>
                          setTrackingInputs((prev) => ({ ...prev, [order.id]: e.target.value }))
                        }
                        className="w-48 rounded-md border border-ink-100 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleShip(order.id)}
                        disabled={shippingId === order.id}
                        className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                      >
                        {shippingId === order.id ? "Shipping..." : "Mark shipped"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
