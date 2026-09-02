"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { fetchOrder, updateOrderStatus, refundPayment, addOrderNote, type OrderDetail, type OrderStatus } from "@/lib/api";
import { formatCents, formatPaymentMethod } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/lib/auth-context";
import { useStoreSettings } from "@/lib/store-settings-context";
import { NEXT_STATES, ACTION_LABELS, STATUS_HISTORY_LABELS, HAPPY_PATH_STATUSES } from "@/lib/orderStateMachine";
import { RefundPanel } from "@/components/RefundPanel";
import { ReturnRequestsCard } from "@/components/ReturnRequestsCard";
import { DeliveryProgress } from "@/components/DeliveryProgress";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  // Arrived at from a context that only wants to review the order (e.g. the
  // Payments list, linking to a transaction's order for reference) — hides
  // status-transition/refund/note-editing controls so it reads as a summary,
  // not an invitation to change order state from what should be a lookup.
  const readOnly = searchParams.get("readonly") === "1";
  const { user } = useAuth();
  const { settings } = useStoreSettings();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<OrderStatus | null>(null);
  const [refundPanelOpen, setRefundPanelOpen] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);

  function load() {
    fetchOrder(Number(params.id))
      .then(setOrder)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load order."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [params.id]);

  async function handleTransition(status: OrderStatus) {
    if (status === "REFUNDED") {
      // Opens the refund panel instead of firing immediately — refunding
      // needs to go through the payments endpoint (which actually calls
      // Stripe), and when partial refunds are enabled the admin may want to
      // specify an amount/items rather than always refunding in full.
      setActionError(null);
      setRefundPanelOpen(true);
      return;
    }
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

  async function handleAddNote() {
    const trimmed = noteBody.trim();
    if (!trimmed) return;
    setNoteError(null);
    setNoteSaving(true);
    try {
      const updated = await addOrderNote(Number(params.id), trimmed);
      setOrder(updated);
      setNoteBody("");
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : "Failed to add note.");
    } finally {
      setNoteSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-ink-500">Loading...</p>;
  if (error) return <p className="text-sm text-brand-600">{error}</p>;
  if (!order) return null;

  const canStaffAct = !readOnly && (user?.role === "ADMIN" || user?.role === "FULFILLMENT_STAFF");
  const canReviewReturns = !readOnly && user?.role === "ADMIN";

  // Fixed happy-path roadmap (Placed -> Paid -> Shipped -> Delivered) so a
  // step not yet reached still gets a slot in the timeline, shown greyed out
  // rather than simply missing. If the order branched off the happy path
  // (Cancelled/Refunded/Returned/PartiallyRefunded), the roadmap stops at
  // wherever it left off and that branch event is appended as the final,
  // highlighted step — matching what actually happened instead of implying
  // the order is still headed toward Delivered.
  const historyByStatus = new Map(order.statusHistory.map((entry) => [entry.status, entry]));
  const branchEntry = order.statusHistory.find((entry) => !HAPPY_PATH_STATUSES.includes(entry.status));
  const timelineSteps = [
    ...HAPPY_PATH_STATUSES.filter((status) => !branchEntry || historyByStatus.has(status)).map((status) => ({
      status,
      changedAt: historyByStatus.get(status)?.changedAt ?? null,
      reached: historyByStatus.has(status),
    })),
    ...(branchEntry ? [{ status: branchEntry.status, changedAt: branchEntry.changedAt, reached: true }] : []),
  ];

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

      {refundPanelOpen && (
        <RefundPanel
          order={order}
          allowPartialRefunds={settings?.allowPartialRefunds ?? false}
          onClose={() => setRefundPanelOpen(false)}
          onRefunded={(updated) => {
            setOrder(updated);
            setRefundPanelOpen(false);
          }}
        />
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
          <p className="text-sm font-medium text-ink-900">Timeline</p>
        </div>
        <div className="px-5 py-5">
          {order.statusHistory.length === 0 ? (
            <p className="text-sm text-ink-500">No status history recorded.</p>
          ) : (
            <ol className="space-y-4">
              {timelineSteps.map((step, i) => {
                const isLastStep = i === timelineSteps.length - 1;
                const isCurrent = step.reached && (isLastStep || !timelineSteps[i + 1].reached);
                return (
                  <li key={step.status} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          !step.reached ? "bg-ink-100" : isCurrent ? "bg-brand-500" : "bg-ink-300"
                        }`}
                      />
                      {!isLastStep && <span className="mt-1 w-px flex-1 bg-ink-100" />}
                    </div>
                    <div className="pb-1">
                      <p className={`text-sm font-medium ${step.reached ? "text-ink-900" : "text-ink-400"}`}>
                        {STATUS_HISTORY_LABELS[step.status]}
                      </p>
                      <p className="text-xs text-ink-500">
                        {step.changedAt
                          ? new Date(step.changedAt).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "Not yet reached"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
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
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-500">Shipping address</p>
              <p className="mt-1 whitespace-pre-line text-sm text-ink-900">{order.shippingAddress}</p>
            </div>
            {(order.shippingCountry || order.carrier) && (
              <div className="shrink-0 text-right">
                {order.shippingCountry && (
                  <p className="text-xs uppercase tracking-wide text-ink-500">{order.shippingCountry}</p>
                )}
                {order.carrier && <p className="mt-1 text-sm text-ink-900">{order.carrier}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {order.trackingNumber && (
        <div className="mt-6 rounded-xl border border-ink-100 bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-500">Delivery tracking</p>
              <div className="mt-2">
                <DeliveryProgress status={order.deliveryStatus} />
              </div>
            </div>
            {order.easypostTrackingUrl && (
              <a
                href={order.easypostTrackingUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-sm font-medium text-brand-600 hover:underline"
              >
                View tracking →
              </a>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-ink-100 bg-white">
        <div className="border-b border-ink-100 px-5 py-4">
          <p className="text-sm font-medium text-ink-900">Notes</p>
          <p className="mt-0.5 text-xs text-ink-400">Internal only — never shown to the customer.</p>
        </div>
        <div className="px-5 py-4">
          {!readOnly && (
            <>
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value.slice(0, 2000))}
                placeholder="Leave a note for other staff (e.g. customer called, wants address changed)..."
                rows={2}
                className="w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
              <div className="mt-2 flex items-center justify-between">
                {noteError ? <p className="text-sm text-brand-600">{noteError}</p> : <span />}
                <button
                  onClick={handleAddNote}
                  disabled={noteSaving || !noteBody.trim()}
                  className="rounded-md bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  {noteSaving ? "Adding..." : "Add note"}
                </button>
              </div>
            </>
          )}

          {order.notes.length > 0 && (
            <ul className="mt-4 space-y-3 border-t border-ink-100 pt-4">
              {order.notes.map((note) => (
                <li key={note.id} className="text-sm">
                  <p className="whitespace-pre-line text-ink-900">{note.body}</p>
                  <p className="mt-1 text-xs text-ink-500">
                    {note.authorName} ·{" "}
                    {new Date(note.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ReturnRequestsCard
        order={order}
        canLog={canStaffAct}
        canReview={canReviewReturns}
        onUpdated={setOrder}
      />
    </div>
  );
}
