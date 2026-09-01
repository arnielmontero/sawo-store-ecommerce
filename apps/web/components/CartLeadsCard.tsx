"use client";

import { useState } from "react";
import { deleteCartLead, fetchProduct, fetchProducts, logCartLead, type CartLead, type Product, type VariantDetail } from "@/lib/api";
import { formatCents } from "@/lib/format";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function CartLeadsCard({
  userId,
  cartLeads,
  canLog,
  onReload,
}: {
  userId: number;
  cartLeads: CartLead[];
  canLog: boolean;
  onReload: () => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [openProductId, setOpenProductId] = useState<number | null>(null);
  const [openProductVariants, setOpenProductVariants] = useState<VariantDetail[] | null>(null);
  const [selectedItems, setSelectedItems] = useState<{ variantId: number; label: string; quantity: number }[]>([]);
  const [note, setNote] = useState("");
  const [logging, setLogging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function handleSearch() {
    if (!productSearch.trim()) return;
    setSearching(true);
    try {
      const result = await fetchProducts({ search: productSearch.trim() });
      setProducts(result.products);
    } finally {
      setSearching(false);
    }
  }

  async function openProduct(product: Product) {
    if (openProductId === product.id) {
      setOpenProductId(null);
      setOpenProductVariants(null);
      return;
    }
    setOpenProductId(product.id);
    setOpenProductVariants(null);
    const detail = await fetchProduct(product.id);
    setOpenProductVariants(detail.variants);
  }

  function addVariant(variantId: number, label: string) {
    setSelectedItems((prev) => {
      if (prev.some((i) => i.variantId === variantId)) return prev;
      return [...prev, { variantId, label, quantity: 1 }];
    });
  }

  function removeVariant(variantId: number) {
    setSelectedItems((prev) => prev.filter((i) => i.variantId !== variantId));
  }

  function setQuantity(variantId: number, quantity: number) {
    setSelectedItems((prev) => prev.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.max(1, quantity) } : i)));
  }

  async function handleLog() {
    if (selectedItems.length === 0) return;
    setLogging(true);
    setError(null);
    try {
      await logCartLead(
        userId,
        selectedItems.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        note.trim() || undefined
      );
      onReload();
      setFormOpen(false);
      setSelectedItems([]);
      setProducts([]);
      setProductSearch("");
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log cart lead.");
    } finally {
      setLogging(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await deleteCartLead(id);
      onReload();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-ink-100 bg-white">
      <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
        <div>
          <p className="text-sm font-medium text-ink-900">Cart interest</p>
          <p className="mt-0.5 text-xs text-ink-400">
            No storefront cart exists yet — these are leads staff logged from what a customer said they wanted, not a live cart.
          </p>
        </div>
        {canLog && !formOpen && (
          <button
            onClick={() => setFormOpen(true)}
            className="shrink-0 rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50"
          >
            Log cart interest
          </button>
        )}
      </div>

      {formOpen && (
        <div className="border-b border-ink-100 px-5 py-4">
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">Find a product</label>
          <div className="mt-2 flex gap-2">
            <input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search products..."
              className="flex-1 rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            <button
              onClick={handleSearch}
              disabled={searching || !productSearch.trim()}
              className="rounded-md border border-ink-100 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {searching ? "..." : "Search"}
            </button>
          </div>

          {products.length > 0 && (
            <ul className="mt-2 max-h-64 overflow-y-auto rounded-md border border-ink-100">
              {products.map((p) => (
                <li key={p.id} className="border-b border-ink-100 last:border-0">
                  <button
                    onClick={() => openProduct(p)}
                    className="w-full px-3 py-2 text-left text-sm text-ink-900 hover:bg-gray-50 hover:text-brand-600"
                  >
                    {p.title}
                  </button>
                  {openProductId === p.id && (
                    <div className="border-t border-ink-100 bg-gray-50 px-3 py-2">
                      {!openProductVariants ? (
                        <p className="text-xs text-ink-500">Loading variants...</p>
                      ) : (
                        <ul className="space-y-1">
                          {openProductVariants.map((v) => (
                            <li key={v.id} className="flex items-center justify-between text-xs">
                              <span className="text-ink-700">
                                {v.sku} · {formatCents(v.priceCents)}
                              </span>
                              <button
                                onClick={() => addVariant(v.id, `${p.title} (${v.sku})`)}
                                disabled={selectedItems.some((i) => i.variantId === v.id)}
                                className="rounded-md border border-ink-100 px-2 py-1 font-medium text-ink-700 hover:bg-white disabled:opacity-40"
                              >
                                {selectedItems.some((i) => i.variantId === v.id) ? "Added" : "Add"}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {selectedItems.length > 0 && (
            <ul className="mt-3 space-y-2">
              {selectedItems.map((item) => (
                <li key={item.variantId} className="flex items-center gap-3 text-sm">
                  <span className="flex-1 text-ink-900">{item.label}</span>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => setQuantity(item.variantId, Number(e.target.value))}
                    className="w-16 rounded-md border border-ink-100 px-2 py-1 text-sm outline-none focus:border-brand-500"
                  />
                  <button onClick={() => removeVariant(item.variantId)} className="text-xs text-brand-600 hover:underline">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-ink-500">Note (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 2000))}
            rows={2}
            placeholder="What the customer said..."
            className="mt-2 w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
          {error && <p className="mt-2 text-sm text-brand-600">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => {
                setFormOpen(false);
                setSelectedItems([]);
                setError(null);
              }}
              disabled={logging}
              className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleLog}
              disabled={logging || selectedItems.length === 0}
              className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {logging ? "Logging..." : "Log cart interest"}
            </button>
          </div>
        </div>
      )}

      <div className="px-5 py-4">
        {cartLeads.length === 0 ? (
          <p className="text-sm text-ink-500">No cart interest logged for this customer.</p>
        ) : (
          <ul className="space-y-4">
            {cartLeads.map((lead) => (
              <li key={lead.id} className="rounded-lg border border-ink-100 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-ink-500">
                    Logged by {lead.loggedByName} · {formatDateTime(lead.createdAt)}
                  </span>
                  {canLog && (
                    <button
                      onClick={() => handleDelete(lead.id)}
                      disabled={deletingId === lead.id}
                      className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
                    >
                      {deletingId === lead.id ? "Removing..." : "Remove"}
                    </button>
                  )}
                </div>
                <ul className="mt-2 space-y-1">
                  {lead.items.map((item) => (
                    <li key={item.id} className="text-sm text-ink-900">
                      {item.variant.product.title} <span className="text-ink-400">({item.variant.sku})</span> · qty {item.quantity} ·{" "}
                      {formatCents(item.variant.priceCents * item.quantity)}
                    </li>
                  ))}
                </ul>
                {lead.note && <p className="mt-2 text-sm text-ink-500">{lead.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
