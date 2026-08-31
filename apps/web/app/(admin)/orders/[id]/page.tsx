"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchOrder, updateOrderStatus, type OrderDetail, type OrderStatus } from "@/lib/api";
import { formatCents, formatPaymentMethod } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/lib/auth-context";
import { NEXT_STATES, ACTION_LABELS } from "@/lib/orderStateMachine";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<OrderStatus | null>(null);

  function load() {
    fetchOrder(Number(params.id))
      .then(setOrder)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load order."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [params.id]);

  async function handleTransition(status: OrderStatus) {
    setActionError(null);
    setUpdating(status);
    try {
      const updated = await updateOrderStatus(Number(params.id), status);
      setOrder(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update order status.");
    } finally {
      setUpdating(null);
    }
  }

  if (loading) return <p className="text-sm text-ink-500">Loading...</p>;
  if (error) return <p className="text-sm text-brand-600">{error}</p>;
  if (!order) return null;

  const canStaffAct = user?.role === "ADMIN" || user?.role === "FULFILLMENT_STAFF";

  return (
    <div>
      <Link href="/orders" className="text-sm text-ink-500 hover:text-brand-600">
        ← Back to Orders
      </Link>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-ink-900">{order.reference}</h1>
          <StatusBadge status={order.status} />
        </div>
        {canStaffAct && NEXT_STATES[order.status].length > 0 && (
          <div className="flex items-center gap-2">
            {NEXT_STATES[order.status].map((next) => (
              <button
                key={next}
                onClick={() => handleTransition(next)}
                disabled={updating !== null}
                className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${
                  next === "CANCELLED" || next === "REFUNDED" || next === "RETURNED"
                    ? "border border-ink-100 text-ink-700 hover:bg-gray-50"
                    : "bg-brand-500 text-white hover:bg-brand-600"
                }`}
              >
                {updating === next ? "Updating..." : ACTION_LABELS[next]}
              </button>
            ))}
          </div>
        )}
      </div>

      {actionError && (
        <p className="mt-4 rounded-md bg-brand-50 px-4 py-2 text-sm text-brand-600">{actionError}</p>
      )}

      <div className="mt-6 grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-ink-100 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-ink-500">Customer</p>
          <p className="mt-1 text-sm font-semibold text-ink-900">
            {order.user ? (
              <Link href={`/customers/${order.user.id}`} className="hover:text-brand-600 hover:underline">
                {order.user.email}
              </Link>
            ) : (
              "Guest"
            )}
          </p>
        </div>
        <div className="rounded-xl border border-ink-100 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-ink-500">Payment</p>
          <p className="mt-1 text-sm font-semibold text-ink-900">
            {order.paymentMethod ? formatPaymentMethod(order.paymentMethod) : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-ink-100 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-ink-500">Tracking number</p>
          <p className="mt-1 text-sm font-semibold text-ink-900">{order.trackingNumber ?? "—"}</p>
        </div>
        <div className="rounded-xl border border-ink-100 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-ink-500">Ordered</p>
          <p className="mt-1 text-sm font-semibold text-ink-900">
            {new Date(order.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-ink-100 bg-white">
        <div className="border-b border-ink-100 px-5 py-4">
          <p className="text-sm font-medium text-ink-900">Items</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-3 py-3 font-medium">SKU</th>
                <th className="px-3 py-3 font-medium">Attributes</th>
                <th className="px-3 py-3 font-medium">Qty</th>
                <th className="px-3 py-3 font-medium">Unit price</th>
                <th className="px-3 py-3 font-medium">Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-ink-100 last:border-0">
                  <td className="px-5 py-3 font-medium text-ink-900">{item.variant.product.title}</td>
                  <td className="px-3 py-3 font-mono text-xs text-ink-500">{item.variant.sku}</td>
                  <td className="px-3 py-3 text-ink-700">
                    {Object.entries(item.variant.attributes)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ") || "—"}
                  </td>
                  <td className="px-3 py-3 text-ink-700">{item.quantity}</td>
                  <td className="px-3 py-3 text-ink-700">{formatCents(item.unitPriceCents, order.currency)}</td>
                  <td className="px-3 py-3 text-ink-700">
                    {formatCents(item.unitPriceCents * item.quantity, order.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-1.5 border-t border-ink-100 px-5 py-4 text-sm">
          <div className="flex justify-between text-ink-700">
            <span>Subtotal</span>
            <span>{formatCents(order.subtotalCents, order.currency)}</span>
          </div>
          {order.discountCents > 0 && (
            <div className="flex justify-between text-ink-700">
              <span>Discount</span>
              <span>-{formatCents(order.discountCents, order.currency)}</span>
            </div>
          )}
          {order.shippingCents > 0 && (
            <div className="flex justify-between text-ink-700">
              <span>Shipping</span>
              <span>{formatCents(order.shippingCents, order.currency)}</span>
            </div>
          )}
          {order.taxCents > 0 && (
            <div className="flex justify-between text-ink-700">
              <span>Tax</span>
              <span>{formatCents(order.taxCents, order.currency)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-ink-100 pt-1.5 font-semibold text-ink-900">
            <span>Total</span>
            <span>{formatCents(order.totalCents, order.currency)}</span>
          </div>
        </div>
      </div>

      {order.shippingAddress && (
        <div className="mt-6 rounded-xl border border-ink-100 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-ink-500">Shipping address</p>
          <p className="mt-1 whitespace-pre-line text-sm text-ink-900">{order.shippingAddress}</p>
        </div>
      )}
    </div>
  );
}
