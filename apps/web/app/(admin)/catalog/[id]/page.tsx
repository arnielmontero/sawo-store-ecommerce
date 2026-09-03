"use client";

import { Fragment, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  fetchCategories,
  fetchProduct,
  updateProduct,
  deactivateProduct,
  setVariantStock,
  setVariantActive,
  type Category,
  type ProductDetail,
} from "@/lib/api";
import { formatCents } from "@/lib/format";
import { ProductImageGallery } from "@/components/ProductImageGallery";
import { VariantMatrixGenerator } from "@/components/VariantMatrixGenerator";
import { AddVariantForm } from "@/components/AddVariantForm";
import { TagInput } from "@/components/TagInput";
import { ReviewsAndQnaPanel } from "@/components/ReviewsAndQnaPanel";
import { useAuth } from "@/lib/auth-context";
import { hasPermission } from "@/lib/permissions";

const LOW_STOCK_THRESHOLD = 10;

// datetime-local inputs need "YYYY-MM-DDTHH:mm" in the browser's local time
// (no seconds, no timezone) — converts to/from the ISO strings the API
// stores/returns.
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [saleStartsAt, setSaleStartsAt] = useState("");
  const [saleEndsAt, setSaleEndsAt] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [seoOpen, setSeoOpen] = useState(false);
  const [stockDrafts, setStockDrafts] = useState<Record<number, string>>({});
  const [stockSavingId, setStockSavingId] = useState<number | null>(null);
  const [variantTogglingId, setVariantTogglingId] = useState<number | null>(null);
  const [saleEditorVariantId, setSaleEditorVariantId] = useState<number | null>(null);
  const [variantSaleDrafts, setVariantSaleDrafts] = useState<
    Record<number, { compareAtPrice: string; saleStartsAt: string; saleEndsAt: string }>
  >({});
  const [variantSaleSavingId, setVariantSaleSavingId] = useState<number | null>(null);
  const [variantImageDrafts, setVariantImageDrafts] = useState<Record<number, string>>({});
  const [variantSearch, setVariantSearch] = useState("");

  const productId = Number(params.id);

  function load() {
    Promise.all([fetchProduct(productId), fetchCategories()])
      .then(([p, cats]) => {
        setProduct(p);
        setCategories(cats);
        setTitle(p.title);
        setDescription(p.description ?? "");
        setBasePrice((p.basePriceCents / 100).toString());
        setCompareAtPrice(p.compareAtPriceCents ? (p.compareAtPriceCents / 100).toString() : "");
        setSaleStartsAt(isoToLocalInput(p.saleStartsAt));
        setSaleEndsAt(isoToLocalInput(p.saleEndsAt));
        setCategoryId(p.categoryId ? String(p.categoryId) : "");
        setTags(p.tags.map((t) => t.name));
        setMetaTitle(p.metaTitle ?? "");
        setMetaDescription(p.metaDescription ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load product."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [productId]);

  async function handleSave() {
    setSaveError(null);
    const priceCents = Math.round(parseFloat(basePrice) * 100);
    if (isNaN(priceCents) || priceCents <= 0) {
      setSaveError("Enter a valid price.");
      return;
    }
    const compareAtPriceCents = compareAtPrice ? Math.round(parseFloat(compareAtPrice) * 100) : null;
    if (compareAtPrice && (isNaN(compareAtPriceCents!) || compareAtPriceCents! <= priceCents)) {
      setSaveError("Compare-at price must be higher than the base price.");
      return;
    }
    if (saleStartsAt && saleEndsAt && new Date(saleStartsAt) >= new Date(saleEndsAt)) {
      setSaveError("Deal end date must be after the start date.");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateProduct(productId, {
        title,
        description: description || undefined,
        basePriceCents: priceCents,
        compareAtPriceCents,
        saleStartsAt: localInputToIso(saleStartsAt),
        saleEndsAt: localInputToIso(saleEndsAt),
        categoryId: categoryId ? Number(categoryId) : null,
        tags,
        metaTitle: metaTitle || undefined,
        metaDescription: metaDescription || undefined,
      });
      setProduct(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save product.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivateToggle() {
    if (!product) return;
    setDeactivating(true);
    setSaveError(null);
    try {
      if (product.isActive) {
        await deactivateProduct(productId);
        setProduct({ ...product, isActive: false });
      } else {
        const updated = await updateProduct(productId, { isActive: true });
        setProduct(updated);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update product status.");
    } finally {
      setDeactivating(false);
    }
  }

  async function handleStockSave(variantId: number) {
    const raw = stockDrafts[variantId];
    const quantity = Number(raw);
    if (raw === undefined || isNaN(quantity) || quantity < 0) {
      setSaveError("Enter a valid stock quantity.");
      return;
    }
    setStockSavingId(variantId);
    setSaveError(null);
    try {
      const inventory = await setVariantStock(variantId, quantity);
      setProduct((prev) =>
        prev
          ? {
              ...prev,
              variants: prev.variants.map((v) =>
                v.id === variantId ? { ...v, inventory: { ...inventory } } : v
              ),
            }
          : prev
      );
      setStockDrafts((prev) => {
        const next = { ...prev };
        delete next[variantId];
        return next;
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update stock.");
    } finally {
      setStockSavingId(null);
    }
  }

  async function handleVariantActiveToggle(variantId: number, nextActive: boolean) {
    setVariantTogglingId(variantId);
    setSaveError(null);
    try {
      const updated = await setVariantActive(variantId, nextActive);
      setProduct((prev) =>
        prev
          ? { ...prev, variants: prev.variants.map((v) => (v.id === variantId ? { ...v, isActive: updated.isActive } : v)) }
          : prev
      );
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update variant visibility.");
    } finally {
      setVariantTogglingId(null);
    }
  }

  function openVariantSaleEditor(variant: ProductDetail["variants"][number]) {
    setVariantSaleDrafts((prev) => ({
      ...prev,
      [variant.id]: {
        compareAtPrice: variant.compareAtPriceCents ? (variant.compareAtPriceCents / 100).toString() : "",
        saleStartsAt: isoToLocalInput(variant.saleStartsAt),
        saleEndsAt: isoToLocalInput(variant.saleEndsAt),
      },
    }));
    setSaleEditorVariantId(variant.id);
  }

  async function handleVariantSaleSave(variant: ProductDetail["variants"][number]) {
    const draft = variantSaleDrafts[variant.id];
    if (!draft) return;
    setSaveError(null);
    const compareAtPriceCents = draft.compareAtPrice ? Math.round(parseFloat(draft.compareAtPrice) * 100) : null;
    if (draft.compareAtPrice && (isNaN(compareAtPriceCents!) || compareAtPriceCents! <= variant.priceCents)) {
      setSaveError("Variant compare-at price must be higher than the variant's price.");
      return;
    }
    if (draft.saleStartsAt && draft.saleEndsAt && new Date(draft.saleStartsAt) >= new Date(draft.saleEndsAt)) {
      setSaveError("Variant deal end date must be after the start date.");
      return;
    }
    setVariantSaleSavingId(variant.id);
    try {
      const updated = await updateProduct(productId, {
        variants: [
          {
            id: variant.id,
            sku: variant.sku,
            priceCents: variant.priceCents,
            compareAtPriceCents,
            saleStartsAt: localInputToIso(draft.saleStartsAt),
            saleEndsAt: localInputToIso(draft.saleEndsAt),
          },
        ],
      });
      setProduct(updated);
      setSaleEditorVariantId(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update variant deal.");
    } finally {
      setVariantSaleSavingId(null);
    }
  }

  async function handleVariantImageSave(variantId: number) {
    const url = variantImageDrafts[variantId]?.trim();
    setSaveError(null);
    try {
      const updated = await updateProduct(productId, {
        variants: [
          {
            id: variantId,
            sku: product!.variants.find((v) => v.id === variantId)!.sku,
            priceCents: product!.variants.find((v) => v.id === variantId)!.priceCents,
            imageUrl: url || null,
          },
        ],
      });
      setProduct(updated);
      setVariantImageDrafts((prev) => {
        const next = { ...prev };
        delete next[variantId];
        return next;
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update variant image.");
    }
  }

  if (loading) return <p className="text-sm text-ink-500">Loading...</p>;
  if (error) return <p className="text-sm text-brand-600">{error}</p>;
  if (!product) return null;

  const variantQuery = variantSearch.trim().toLowerCase();
  const filteredVariants = variantQuery
    ? product.variants.filter((v) => {
        const attrText = v.attributes
          ? Object.entries(v.attributes).map(([k, val]) => `${k} ${val}`).join(" ")
          : "";
        return v.sku.toLowerCase().includes(variantQuery) || attrText.toLowerCase().includes(variantQuery);
      })
    : product.variants;

  return (
    <div>
      <Link href="/catalog" className="text-sm text-ink-500 hover:text-brand-600">
        ← Back to Catalog
      </Link>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-ink-900">{product.title}</h1>
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
              product.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-ink-500"
            }`}
          >
            {product.isActive ? "Active" : "Inactive"}
          </span>
          {product.isBestSeller && (
            <span
              className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
              title="Among the top sellers by completed units sold"
            >
              Best Seller
            </span>
          )}
          {product.isNew && (
            <span
              className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700"
              title="Added within the last 30 days"
            >
              New
            </span>
          )}
          {product.isOnSale && (
            <span
              className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
              title={product.saleEndsAt ? `Deal ends ${new Date(product.saleEndsAt).toLocaleString()}` : "Compare-at price is set above the current price"}
            >
              Sale{product.saleEndsAt ? ` · ends ${new Date(product.saleEndsAt).toLocaleDateString()}` : ""}
            </span>
          )}
        </div>
        <button
          onClick={handleDeactivateToggle}
          disabled={deactivating}
          className="rounded-md border border-ink-100 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {deactivating ? "Working..." : product.isActive ? "Deactivate" : "Reactivate"}
        </button>
      </div>

      {saveError && (
        <p className="mt-4 rounded-md bg-brand-50 px-4 py-2 text-sm text-brand-600">{saveError}</p>
      )}

      <div className="mt-6 rounded-xl border border-ink-100 bg-white p-6">
        <p className="text-sm font-medium text-ink-900">Images</p>
        <div className="mt-3">
          <ProductImageGallery
            productId={productId}
            images={product.images}
            onChange={(images) => setProduct({ ...product, images })}
          />
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-ink-100 bg-white p-6">
        <p className="text-sm font-medium text-ink-900">Product details</p>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
              Base price ({product.currency.toUpperCase()})
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
              Compare-at price (optional — shows a sale)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={compareAtPrice}
              onChange={(e) => setCompareAtPrice(e.target.value)}
              placeholder="e.g. 50.00"
              className="mt-1.5 w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </div>
          {compareAtPrice && (
            <div className="col-span-2 grid grid-cols-2 gap-4 rounded-md border border-ink-100 bg-gray-50 p-3">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
                  Deal starts (optional)
                </label>
                <input
                  type="datetime-local"
                  value={saleStartsAt}
                  onChange={(e) => setSaleStartsAt(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-ink-100 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
                <p className="mt-1 text-xs text-ink-400">Leave blank to start immediately.</p>
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
                  Deal ends (optional)
                </label>
                <input
                  type="datetime-local"
                  value={saleEndsAt}
                  onChange={(e) => setSaleEndsAt(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-ink-100 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
                <p className="mt-1 text-xs text-ink-400">Leave blank to run until turned off.</p>
              </div>
            </div>
          )}
          <div className="col-span-2">
            <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">Tags</label>
            <TagInput tags={tags} onChange={setTags} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1.5 w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        <div className="mt-6 border-t border-ink-100 pt-5">
          <button
            onClick={() => setSeoOpen((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <span>
              <span className="text-sm font-medium text-ink-900">Search engine listing</span>
              <span className="ml-2 text-xs text-ink-400">Optional — controls how this product looks in search results</span>
            </span>
            <span className="text-ink-400">{seoOpen ? "−" : "+"}</span>
          </button>

          {seoOpen && (
            <div className="mt-4 grid grid-cols-1 gap-4">
              <div>
                <div className="flex items-baseline justify-between">
                  <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
                    Meta title
                  </label>
                  <span className="text-xs text-ink-400">{metaTitle.length}/70</span>
                </div>
                <input
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value.slice(0, 70))}
                  placeholder={title || "Defaults to the product title"}
                  className="mt-1.5 w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <div className="flex items-baseline justify-between">
                  <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
                    Meta description
                  </label>
                  <span className="text-xs text-ink-400">{metaDescription.length}/320</span>
                </div>
                <textarea
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value.slice(0, 320))}
                  rows={2}
                  placeholder={description || "A short summary shown under the title in search results"}
                  className="mt-1.5 w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-6 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-ink-100 bg-white">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <p className="text-sm font-medium text-ink-900">
            Variants ({filteredVariants.length}
            {filteredVariants.length !== product.variants.length ? ` of ${product.variants.length}` : ""})
          </p>
          <div className="flex items-center gap-2">
            {product.variants.length > 5 && (
              <input
                type="text"
                value={variantSearch}
                onChange={(e) => setVariantSearch(e.target.value)}
                placeholder="Search SKU or attributes..."
                className="w-56 rounded-md border border-ink-100 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
              />
            )}
            <AddVariantForm productId={productId} basePriceCents={product.basePriceCents} onAdded={setProduct} />
            <VariantMatrixGenerator productId={productId} onGenerated={setProduct} />
          </div>
        </div>
        {filteredVariants.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">No variants match your search.</p>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-3 py-3 font-medium">Attributes</th>
                <th className="px-3 py-3 font-medium">Price</th>
                <th className="px-3 py-3 font-medium">Image URL</th>
                <th className="px-3 py-3 font-medium">Reserved</th>
                <th className="px-3 py-3 font-medium">Stock</th>
                <th className="px-3 py-3 font-medium">Visible</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filteredVariants.map((variant) => (
                <Fragment key={variant.id}>
                <tr
                  className={`border-b border-ink-100 last:border-0 ${variant.isActive ? "" : "bg-gray-50 text-ink-400"}`}
                >
                  <td className="px-5 py-3 font-mono text-xs text-ink-700">{variant.sku}</td>
                  <td className="px-3 py-3 text-ink-700">
                    {variant.attributes
                      ? Object.entries(variant.attributes)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(", ")
                      : "—"}
                  </td>
                  <td className="px-3 py-3 text-ink-700">
                    {variant.isOnSale && variant.compareAtPriceCents ? (
                      <span className="flex items-center gap-1.5">
                        <span className="text-brand-600">{formatCents(variant.priceCents, product.currency)}</span>
                        <span className="text-xs text-ink-400 line-through">
                          {formatCents(variant.compareAtPriceCents, product.currency)}
                        </span>
                      </span>
                    ) : (
                      formatCents(variant.priceCents, product.currency)
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="text"
                      placeholder="Falls back to featured image"
                      value={variantImageDrafts[variant.id] ?? variant.imageUrl ?? ""}
                      onChange={(e) =>
                        setVariantImageDrafts((prev) => ({ ...prev, [variant.id]: e.target.value }))
                      }
                      onBlur={() => {
                        if (variantImageDrafts[variant.id] !== undefined) handleVariantImageSave(variant.id);
                      }}
                      className="w-40 rounded-md border border-ink-100 px-2 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    />
                  </td>
                  <td className="px-3 py-3 text-ink-700">{variant.inventory?.reservedQuantity ?? 0}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={stockDrafts[variant.id] ?? String(variant.inventory?.stockQuantity ?? 0)}
                        onChange={(e) =>
                          setStockDrafts((prev) => ({ ...prev, [variant.id]: e.target.value }))
                        }
                        className="w-24 rounded-md border border-ink-100 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      />
                      {(variant.inventory?.stockQuantity ?? 0) <= LOW_STOCK_THRESHOLD && (
                        <span
                          className="inline-flex shrink-0 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-600"
                          title={`At or below the low-stock threshold of ${LOW_STOCK_THRESHOLD} units`}
                        >
                          Low
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => handleVariantActiveToggle(variant.id, !variant.isActive)}
                      disabled={variantTogglingId === variant.id}
                      title={
                        variant.isActive
                          ? "Visible on the storefront — click to hide this variant"
                          : "Hidden from the storefront — click to make it visible again"
                      }
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
                        variant.isActive ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-gray-100 text-ink-500 hover:bg-gray-200"
                      }`}
                    >
                      {variantTogglingId === variant.id ? "..." : variant.isActive ? "Visible" : "Hidden"}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() =>
                          saleEditorVariantId === variant.id ? setSaleEditorVariantId(null) : openVariantSaleEditor(variant)
                        }
                        className={`rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-gray-50 ${
                          variant.isOnSale ? "border-emerald-200 text-emerald-700" : "border-ink-100 text-ink-700"
                        }`}
                      >
                        {variant.isOnSale ? "Sale ✓" : "Sale"}
                      </button>
                      <button
                        onClick={() => handleStockSave(variant.id)}
                        disabled={stockSavingId === variant.id}
                        className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {stockSavingId === variant.id ? "Saving..." : "Update stock"}
                      </button>
                    </div>
                  </td>
                </tr>
                {saleEditorVariantId === variant.id && (
                  <tr className="border-b border-ink-100 bg-gray-50">
                    <td colSpan={8} className="px-5 py-4">
                      <div className="grid max-w-2xl grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
                            Compare-at price ({product.currency.toUpperCase()})
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="e.g. 50.00"
                            value={variantSaleDrafts[variant.id]?.compareAtPrice ?? ""}
                            onChange={(e) =>
                              setVariantSaleDrafts((prev) => ({
                                ...prev,
                                [variant.id]: { ...prev[variant.id], compareAtPrice: e.target.value, saleStartsAt: prev[variant.id]?.saleStartsAt ?? "", saleEndsAt: prev[variant.id]?.saleEndsAt ?? "" },
                              }))
                            }
                            className="mt-1.5 w-full rounded-md border border-ink-100 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
                            Deal starts (optional)
                          </label>
                          <input
                            type="datetime-local"
                            value={variantSaleDrafts[variant.id]?.saleStartsAt ?? ""}
                            onChange={(e) =>
                              setVariantSaleDrafts((prev) => ({
                                ...prev,
                                [variant.id]: { compareAtPrice: prev[variant.id]?.compareAtPrice ?? "", saleEndsAt: prev[variant.id]?.saleEndsAt ?? "", saleStartsAt: e.target.value },
                              }))
                            }
                            className="mt-1.5 w-full rounded-md border border-ink-100 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
                            Deal ends (optional)
                          </label>
                          <input
                            type="datetime-local"
                            value={variantSaleDrafts[variant.id]?.saleEndsAt ?? ""}
                            onChange={(e) =>
                              setVariantSaleDrafts((prev) => ({
                                ...prev,
                                [variant.id]: { compareAtPrice: prev[variant.id]?.compareAtPrice ?? "", saleStartsAt: prev[variant.id]?.saleStartsAt ?? "", saleEndsAt: e.target.value },
                              }))
                            }
                            className="mt-1.5 w-full rounded-md border border-ink-100 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                          />
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-ink-400">
                        Leave compare-at price blank to remove this variant&apos;s deal. If blank, the variant falls back
                        to the product-level sale (if any).
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleVariantSaleSave(variant)}
                          disabled={variantSaleSavingId === variant.id}
                          className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                        >
                          {variantSaleSavingId === variant.id ? "Saving..." : "Save deal"}
                        </button>
                        <button
                          onClick={() => setSaleEditorVariantId(null)}
                          className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      <ReviewsAndQnaPanel productId={product.id} canModerate={hasPermission(user, "reviews", "delete")} />
    </div>
  );
}
