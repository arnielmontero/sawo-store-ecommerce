"use client";

import { useState } from "react";
import { adjustStock, type InventoryRow } from "@/lib/api";

export function AdjustStockModal({
  variant,
  onClose,
  onAdjusted,
}: {
  variant: InventoryRow;
  onClose: () => void;
  onAdjusted: () => void;
}) {
  const [quantity, setQuantity] = useState(String(variant.stockQuantity));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedQuantity = Number(quantity);
  const isValid = quantity.trim() !== "" && Number.isInteger(parsedQuantity) && parsedQuantity >= 0 && note.trim();

  async function handleSave() {
    if (!isValid) return;
    setSaving(true);
    setError(null);
    try {
      await adjustStock(variant.variantId, parsedQuantity, note.trim());
      onAdjusted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to adjust stock.");
    } finally {
      setSaving(false);
    }
  }

  const delta = quantity.trim() !== "" && Number.isInteger(parsedQuantity) ? parsedQuantity - variant.stockQuantity : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold text-ink-900">Adjust stock</p>
        <p className="mt-1 text-xs text-ink-500">
          {variant.productTitle} <span className="font-mono">({variant.sku})</span>
        </p>

        <div className="mt-4">
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
            New stock quantity
          </label>
          <input
            autoFocus
            type="number"
            min={0}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            disabled={saving}
            className="mt-2 w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50"
          />
          <p className="mt-1 text-xs text-ink-400">
            Currently {variant.stockQuantity}
            {delta !== null && delta !== 0 && (
              <span className={delta > 0 ? "text-emerald-600" : "text-brand-600"}>
                {" "}
                ({delta > 0 ? "+" : ""}
                {delta})
              </span>
            )}
          </p>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">Reason</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            disabled={saving}
            rows={3}
            placeholder="e.g. Received restock shipment, physical count correction, damaged units removed..."
            className="mt-2 w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50"
          />
        </div>

        {error && <p className="mt-3 text-sm text-brand-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
