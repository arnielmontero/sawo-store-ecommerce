"use client";

import { useState } from "react";
import {
  approveReturnRequest,
  logReturnRequest,
  rejectReturnRequest,
  type OrderDetail,
  type ReturnRequest,
} from "@/lib/api";
import { formatCents } from "@/lib/format";

const STATUS_STYLES: Record<ReturnRequest["status"], string> = {
  PENDING: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-ink-100 text-ink-500",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function ReturnRequestsCard({
  order,
  canLog,
  canReview,
  onUpdated,
}: {
  order: OrderDetail;
  canLog: boolean;
  canReview: boolean;
  onUpdated: (order: OrderDetail) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [selectedItems, setSelectedItems] = useState<Record<number, number>>({});
  const [logging, setLogging] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [resolveError, setResolveError] = useState<{ id: number; message: string } | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});

  function toggleItem(orderItemId: number, maxQuantity: number) {
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (orderItemId in next) {
        delete next[orderItemId];
      } else {
        next[orderItemId] = maxQuantity;
      }
      return next;
    });
  }

  function setItemQuantity(orderItemId: number, quantity: number, maxQuantity: number) {
    setSelectedItems((prev) => ({ ...prev, [orderItemId]: Math.max(1, Math.min(quantity, maxQuantity)) }));
  }

  async function handleLog() {
    const items = Object.entries(selectedItems).map(([orderItemId, quantity]) => ({
      orderItemId: Number(orderItemId),
      quantity,
    }));
    if (!reason.trim() || items.length === 0) return;
    setLogging(true);
    setLogError(null);
    try {
      const updated = await logReturnRequest(order.id, reason.trim(), items);
      onUpdated(updated);
      setFormOpen(false);
      setReason("");
      setSelectedItems({});
    } catch (err) {
      setLogError(err instanceof Error ? err.message : "Failed to log return request.");
    } finally {
      setLogging(false);
    }
  }

  async function handleApprove(requestId: number) {
    setResolvingId(requestId);
    setResolveError(null);
    try {
      const updated = await approveReturnRequest(requestId, { reviewNote: reviewNotes[requestId] });
      onUpdated(updated);
    } catch (err) {
      setResolveError({ id: requestId, message: err instanceof Error ? err.message : "Failed to approve." });
    } finally {
      setResolvingId(null);
    }
  }

  async function handleReject(requestId: number) {
    setResolvingId(requestId);
    setResolveError(null);
    try {
      const updated = await rejectReturnRequest(requestId, reviewNotes[requestId]);
      onUpdated(updated);
    } catch (err) {
      setResolveError({ id: requestId, message: err instanceof Error ? err.message : "Failed to reject." });
    } finally {
      setResolvingId(null);
    }
  }

  function itemLabel(orderItemId: number) {
    const item = order.items.find((i) => i.id === orderItemId);
    return item ? `${item.variant.product.title} (${item.variant.sku})` : `Item ${orderItemId}`;
  }

  const selectedTotalCents = Object.entries(selectedItems).reduce((sum, [orderItemId, quantity]) => {
    const item = order.items.find((i) => i.id === Number(orderItemId));
    return sum + (item ? item.unitPriceCents * quantity : 0);
  }, 0);

  return (
    <div className="mt-6 rounded-xl border border-ink-100 bg-white">
      <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
        <div>
          <p className="text-sm font-medium text-ink-900">Return requests</p>
          <p className="mt-0.5 text-xs text-ink-400">
            Logged on the customer&apos;s behalf — approving moves money via the same refund flow as a direct refund.
          </p>
        </div>
        {canLog && !formOpen && (
          <button
            onClick={() => setFormOpen(true)}
            className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50"
          >
            Log return request
          </button>
        )}
      </div>

      {formOpen && (
        <div className="border-b border-ink-100 px-5 py-4">
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
            Which items?
          </label>
          <ul className="mt-2 space-y-2">
            {order.items.map((item) => {
              const checked = item.id in selectedItems;
              return (
                <li key={item.id} className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleItem(item.id, item.quantity)}
                    className="h-4 w-4"
                  />
                  <span className="flex-1 text-ink-900">
                    {item.variant.product.title} <span className="text-ink-400">({item.variant.sku})</span>
                  </span>
                  {checked && (
                    <input
                      type="number"
                      min={1}
                      max={item.quantity}
                      value={selectedItems[item.id]}
                      onChange={(e) => setItemQuantity(item.id, Number(e.target.value), item.quantity)}
                      className="w-16 rounded-md border border-ink-100 px-2 py-1 text-sm outline-none focus:border-brand-500"
                    />
                  )}
                  <span className="w-10 text-right text-xs text-ink-400">of {item.quantity}</span>
                </li>
              );
            })}
          </ul>

          <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-ink-500">Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 2000))}
            rows={2}
            placeholder="What the customer told you..."
            className="mt-2 w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />

          {Object.keys(selectedItems).length > 0 && (
            <p className="mt-2 text-xs text-ink-500">
              Requested value: {formatCents(selectedTotalCents, order.currency)}
            </p>
          )}
          {logError && <p className="mt-2 text-sm text-brand-600">{logError}</p>}

          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => {
                setFormOpen(false);
                setReason("");
                setSelectedItems({});
                setLogError(null);
              }}
              disabled={logging}
              className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleLog}
              disabled={logging || !reason.trim() || Object.keys(selectedItems).length === 0}
              className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {logging ? "Logging..." : "Log request"}
            </button>
          </div>
        </div>
      )}

      <div className="px-5 py-4">
        {order.returnRequests.length === 0 ? (
          <p className="text-sm text-ink-500">No return requests for this order.</p>
        ) : (
          <ul className="space-y-4">
            {order.returnRequests.map((request) => (
              <li key={request.id} className="rounded-lg border border-ink-100 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[request.status]}`}
                  >
                    {request.status}
                  </span>
                  <span className="text-xs text-ink-500">
                    Logged by {request.loggedByName} · {formatDateTime(request.createdAt)}
                  </span>
                </div>

                <p className="mt-2 text-sm text-ink-900">{request.reason}</p>

                <ul className="mt-2 space-y-1">
                  {request.items.map((line) => (
                    <li key={line.id} className="text-xs text-ink-500">
                      {itemLabel(line.orderItemId)} · qty {line.quantity}
                    </li>
                  ))}
                </ul>

                {request.status !== "PENDING" && (
                  <p className="mt-2 text-xs text-ink-500">
                    {request.status === "APPROVED" ? "Approved" : "Rejected"} by {request.resolvedByName}
                    {request.resolvedAt && ` · ${formatDateTime(request.resolvedAt)}`}
                    {request.reviewNote && (
                      <>
                        <br />
                        {request.reviewNote}
                      </>
                    )}
                  </p>
                )}

                {request.status === "PENDING" && canReview && (
                  <div className="mt-3 border-t border-ink-100 pt-3">
                    <input
                      value={reviewNotes[request.id] ?? ""}
                      onChange={(e) => setReviewNotes((prev) => ({ ...prev, [request.id]: e.target.value }))}
                      placeholder="Optional note (why approved/rejected)..."
                      className="w-full rounded-md border border-ink-100 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    />
                    {resolveError?.id === request.id && (
                      <p className="mt-2 text-xs text-brand-600">{resolveError.message}</p>
                    )}
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        onClick={() => handleReject(request.id)}
                        disabled={resolvingId === request.id}
                        className="rounded-md border border-ink-100 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {resolvingId === request.id ? "Working..." : "Reject"}
                      </button>
                      <button
                        onClick={() => handleApprove(request.id)}
                        disabled={resolvingId === request.id}
                        className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                      >
                        {resolvingId === request.id ? "Working..." : "Approve & refund"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
