"use client";

import { useState } from "react";
import { refundPayment, type OrderDetail } from "@/lib/api";
import { formatCents } from "@/lib/format";

export function RefundPanel({
  order,
  allowPartialRefunds,
  onClose,
  onRefunded,
}: {
  order: OrderDetail;
  allowPartialRefunds: boolean;
  onClose: () => void;
  onRefunded: (order: OrderDetail) => void;
}) {
  const remainingCents = order.totalCents - order.refundedCents;
  const [amount, setAmount] = useState((remainingCents / 100).toFixed(2));
  const [restockQuantities, setRestockQuantities] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      setError("Enter a valid refund amount.");
      return;
    }
    if (amountCents > remainingCents) {
      setError(`Cannot refund more than the remaining balance of ${formatCents(remainingCents, order.currency)}.`);
      return;
    }

    const items = Object.entries(restockQuantities)
      .map(([orderItemId, qty]) => ({ orderItemId: Number(orderItemId), quantity: Number(qty) }))
      .filter((line) => line.quantity > 0);

    setSaving(true);
    try {
      // amountCents === remainingCents means a full refund — omit it so the
      // backend takes its "full remaining balance" default path exactly
      // like it did before partial refunds existed, rather than relying on
      // float rounding to land on the exact same integer.
      const isFull = amountCents >= remainingCents;
      const updated = await refundPayment(order.id, {
        amountCents: isFull ? undefined : amountCents,
        items: items.length > 0 ? items : undefined,
      });
      onRefunded(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process refund.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-ink-100 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-900">Issue refund</p>
        <button onClick={onClose} className="text-sm text-ink-500 hover:text-ink-900">
          Cancel
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-500">
        Remaining balance: {formatCents(remainingCents, order.currency)}
        {order.refundedCents > 0 && ` (already refunded ${formatCents(order.refundedCents, order.currency)})`}
      </p>

      <div className="mt-4">
        <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
          Refund amount ({order.currency.toUpperCase()})
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          max={remainingCents / 100}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={!allowPartialRefunds}
          className="mt-1.5 w-40 rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-ink-400"
        />
        {!allowPartialRefunds && (
          <p className="mt-1 text-xs text-ink-400">
            Partial refunds are off — this will always refund the full remaining balance. Enable them in
            Configuration to refund a specific amount.
          </p>
        )}
      </div>

      <div className="mt-4">
        <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
          Restock items (optional)
        </label>
        <p className="mt-1 text-xs text-ink-400">
          Only set a quantity for units actually being returned to stock — leave at 0 for a refund where nothing
          comes back (e.g. a goodwill discount).
        </p>
        <div className="mt-2 space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-ink-700">
                {item.variant.product.title} <span className="text-ink-400">({item.variant.sku})</span>
              </span>
              <input
                type="number"
                min="0"
                max={item.quantity}
                value={restockQuantities[item.id] ?? ""}
                onChange={(e) =>
                  setRestockQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))
                }
                placeholder="0"
                className="w-20 rounded-md border border-ink-100 px-2 py-1 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>
          ))}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-brand-600">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={saving}
        className="mt-4 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {saving ? "Processing..." : "Issue refund"}
      </button>
    </div>
  );
}
