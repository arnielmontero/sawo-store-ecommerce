"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createProduct, fetchCategories, type Category } from "@/lib/api";
import { TagInput } from "@/components/TagInput";

interface VariantDraft {
  sku: string;
  price: string;
  size: string;
  color: string;
  initialStock: string;
}

function emptyVariant(): VariantDraft {
  return { sku: "", price: "", size: "", color: "", initialStock: "0" };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function NewProductPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([emptyVariant()]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function updateVariant(index: number, patch: Partial<VariantDraft>) {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  function addVariant() {
    setVariants((prev) => [...prev, emptyVariant()]);
  }

  function removeVariant(index: number) {
    setVariants((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleSubmit() {
    setError(null);

    const priceCents = Math.round(parseFloat(basePrice) * 100);
    if (!title.trim()) return setError("Title is required.");
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      return setError("Slug must be lowercase, alphanumeric, hyphen-separated.");
    }
    if (isNaN(priceCents) || priceCents <= 0) return setError("Enter a valid base price.");
    if (variants.some((v) => !v.sku.trim())) return setError("Every variant needs a SKU.");

    const compareAtPriceCents = compareAtPrice ? Math.round(parseFloat(compareAtPrice) * 100) : undefined;
    if (compareAtPrice && (isNaN(compareAtPriceCents!) || compareAtPriceCents! <= priceCents)) {
      return setError("Compare-at price must be higher than the base price.");
    }

    const parsedVariants = variants.map((v) => {
      const variantPriceCents = v.price ? Math.round(parseFloat(v.price) * 100) : priceCents;
      const attributes: Record<string, string> = {};
      if (v.size.trim()) attributes.size = v.size.trim();
      if (v.color.trim()) attributes.color = v.color.trim();
      return {
        sku: v.sku.trim(),
        priceCents: variantPriceCents,
        attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
        initialStock: v.initialStock ? Number(v.initialStock) : 0,
      };
    });

    if (parsedVariants.some((v) => isNaN(v.priceCents) || v.priceCents <= 0)) {
      return setError("Every variant needs a valid price.");
    }

    setSaving(true);
    try {
      const product = await createProduct({
        title: title.trim(),
        slug,
        description: description || undefined,
        basePriceCents: priceCents,
        compareAtPriceCents,
        imageUrl: imageUrl || undefined,
        categoryId: categoryId ? Number(categoryId) : undefined,
        tags: tags.length > 0 ? tags : undefined,
        variants: parsedVariants,
      });
      router.push(`/catalog/${product.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Link href="/catalog" className="text-sm text-ink-500 hover:text-brand-600">
        ← Back to Catalog
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-ink-900">New Product</h1>

      {error && <p className="mt-4 rounded-md bg-brand-50 px-4 py-2 text-sm text-brand-600">{error}</p>}

      <div className="mt-6 rounded-xl border border-ink-100 bg-white p-6">
        <p className="text-sm font-medium text-ink-900">Product details</p>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">Title</label>
            <input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Classic Tee"
              className="mt-1.5 w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">Slug</label>
            <input
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              placeholder="classic-tee"
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
              Base price (USD)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              placeholder="44.10"
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
          <div className="col-span-2">
            <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">Image URL</label>
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://... (or add a full gallery after creating the product)"
              className="mt-1.5 w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </div>
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
      </div>

      <div className="mt-6 rounded-xl border border-ink-100 bg-white p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink-900">Variants</p>
          <button
            onClick={addVariant}
            className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50"
          >
            + Add variant
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {variants.map((variant, index) => (
            <div key={index} className="grid grid-cols-12 items-end gap-2 rounded-md border border-ink-100 p-3">
              <div className="col-span-3">
                <label className="block text-xs text-ink-500">SKU</label>
                <input
                  value={variant.sku}
                  onChange={(e) => updateVariant(index, { sku: e.target.value })}
                  placeholder="TSH-CLASSIC-M-BLK"
                  className="mt-1 w-full rounded-md border border-ink-100 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-ink-500">Size</label>
                <input
                  value={variant.size}
                  onChange={(e) => updateVariant(index, { size: e.target.value })}
                  placeholder="M"
                  className="mt-1 w-full rounded-md border border-ink-100 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-ink-500">Color</label>
                <input
                  value={variant.color}
                  onChange={(e) => updateVariant(index, { color: e.target.value })}
                  placeholder="Black"
                  className="mt-1 w-full rounded-md border border-ink-100 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-ink-500">Price (blank = base)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={variant.price}
                  onChange={(e) => updateVariant(index, { price: e.target.value })}
                  className="mt-1 w-full rounded-md border border-ink-100 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-ink-500">Initial stock</label>
                <input
                  type="number"
                  min="0"
                  value={variant.initialStock}
                  onChange={(e) => updateVariant(index, { initialStock: e.target.value })}
                  className="mt-1 w-full rounded-md border border-ink-100 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div className="col-span-1 flex justify-end">
                <button
                  onClick={() => removeVariant(index)}
                  disabled={variants.length === 1}
                  className="rounded-md p-2 text-ink-400 hover:bg-gray-50 hover:text-brand-600 disabled:opacity-30"
                  aria-label="Remove variant"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={saving}
        className="mt-6 rounded-md bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {saving ? "Creating..." : "Create product"}
      </button>
    </div>
  );
}
