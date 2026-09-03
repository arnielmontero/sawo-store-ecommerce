"use client";

import { useState } from "react";
import { updateProduct, type ProductDetail } from "@/lib/api";

export function AddVariantForm({
  productId,
  basePriceCents,
  onAdded,
}: {
  productId: number;
  basePriceCents: number;
  onAdded: (product: ProductDetail) => void;
}) {
  const [open, setOpen] = useState(false);
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [weight, setWeight] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setError(null);
    if (!sku.trim()) {
      setError("SKU is required.");
      return;
    }
    const priceCents = price ? Math.round(parseFloat(price) * 100) : basePriceCents;
    if (isNaN(priceCents) || priceCents <= 0) {
      setError("Enter a valid price, or leave it blank to use the base price.");
      return;
    }

    const attributes: Record<string, string> = {};
    if (size.trim()) attributes.size = size.trim();
    if (color.trim()) attributes.color = color.trim();

    setSaving(true);
    try {
      const product = await updateProduct(productId, {
        variants: [
          {
            sku: sku.trim(),
            priceCents,
            attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
            weight: weight ? Number(weight) : undefined,
          },
        ],
      });
      onAdded(product);
      setOpen(false);
      setSku("");
      setPrice("");
      setSize("");
      setColor("");
      setWeight("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add variant.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50"
      >
        + Add variant
      </button>
    );
  }

  return (
    <div className="flex items-end gap-2 rounded-md border border-ink-100 bg-gray-50 p-3">
      <div>
        <label className="block text-xs text-ink-500">SKU</label>
        <input
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="SKU-001"
          className="mt-1 w-36 rounded-md border border-ink-100 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <div>
        <label className="block text-xs text-ink-500">Size</label>
        <input
          value={size}
          onChange={(e) => setSize(e.target.value)}
          placeholder="M"
          className="mt-1 w-20 rounded-md border border-ink-100 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <div>
        <label className="block text-xs text-ink-500">Color</label>
        <input
          value={color}
          onChange={(e) => setColor(e.target.value)}
          placeholder="Black"
          className="mt-1 w-24 rounded-md border border-ink-100 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <div>
        <label className="block text-xs text-ink-500">Price (blank = base)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="mt-1 w-28 rounded-md border border-ink-100 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <div>
        <label className="block text-xs text-ink-500">Weight (oz)</label>
        <input
          type="number"
          min="0"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="16"
          className="mt-1 w-20 rounded-md border border-ink-100 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </div>
      {error && <span className="pb-2 text-sm text-brand-600">{error}</span>}
      <button
        onClick={handleAdd}
        disabled={saving}
        className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {saving ? "Adding..." : "Add"}
      </button>
      <button
        onClick={() => setOpen(false)}
        className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-white"
      >
        Cancel
      </button>
    </div>
  );
}
