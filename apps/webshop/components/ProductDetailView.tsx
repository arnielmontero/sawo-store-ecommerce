"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { ProductDetail } from "@/lib/api";
import { formatCents } from "@/lib/format";
import { useCart } from "@/context/CartContext";
import { ProductImagePlaceholder } from "./ProductImagePlaceholder";

function variantLabel(attributes: Record<string, string> | null): string {
  if (!attributes) return "";
  return Object.values(attributes).join(" / ");
}

export function ProductDetailView({ product }: { product: ProductDetail }) {
  const { addItem, openCart } = useCart();
  const [selectedVariantId, setSelectedVariantId] = useState(product.variants[0]?.id);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const selectedVariant = useMemo(
    () => product.variants.find((v) => v.id === selectedVariantId) ?? product.variants[0],
    [product.variants, selectedVariantId]
  );

  const images = product.images.length > 0 ? product.images : [];
  const activeImage = images[activeImageIndex]?.url ?? product.imageUrl;

  const priceCents = selectedVariant?.priceCents ?? product.basePriceCents;
  const compareAtCents = selectedVariant?.compareAtPriceCents ?? product.compareAtPriceCents;
  const outOfStock = !selectedVariant || selectedVariant.availableStock <= 0;

  function handleAddToCart() {
    if (!selectedVariant) return;
    addItem(
      {
        variantId: selectedVariant.id,
        productSlug: product.slug,
        productTitle: product.title,
        variantLabel: variantLabel(selectedVariant.attributes) || null,
        imageUrl: selectedVariant.imageUrl ?? activeImage ?? null,
        priceCents: selectedVariant.priceCents,
        availableStock: selectedVariant.availableStock,
      },
      quantity
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-cream-200">
            {activeImage ? (
              <Image src={activeImage} alt={product.title} fill className="object-contain p-8" priority />
            ) : (
              <ProductImagePlaceholder label={product.category?.name} />
            )}
            {product.isOnSale && (
              <span className="absolute left-4 top-4 rounded-full bg-cedar-600 px-3 py-1 text-xs font-semibold text-white">
                Sale
              </span>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-4 flex gap-3">
              {images.map((img, index) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveImageIndex(index)}
                  className={`relative h-20 w-20 overflow-hidden rounded-xl border-2 ${
                    index === activeImageIndex ? "border-cedar-500" : "border-transparent"
                  }`}
                >
                  <Image src={img.url} alt="" fill className="object-contain p-1.5" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col">
          {product.category && (
            <span className="text-sm font-medium uppercase tracking-wide text-cedar-600">{product.category.name}</span>
          )}
          <h1 className="mt-2 font-serif text-3xl font-semibold text-ink-900">{product.title}</h1>

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-2xl font-semibold text-ink-900">{formatCents(priceCents, product.currency)}</span>
            {compareAtCents && compareAtCents > priceCents && (
              <span className="text-lg text-ink-300 line-through">{formatCents(compareAtCents, product.currency)}</span>
            )}
          </div>

          {product.description && <p className="mt-6 leading-relaxed text-ink-700">{product.description}</p>}

          {product.variants.length > 1 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold text-ink-900">Options</h3>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setSelectedVariantId(variant.id)}
                    disabled={variant.availableStock <= 0}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                      variant.id === selectedVariantId
                        ? "border-cedar-600 bg-cedar-600 text-white"
                        : "border-ink-100 bg-white text-ink-700 hover:border-cedar-400"
                    } ${variant.availableStock <= 0 ? "cursor-not-allowed opacity-40" : ""}`}
                  >
                    {variantLabel(variant.attributes) || variant.sku}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 text-sm">
            {outOfStock ? (
              <span className="font-medium text-red-600">Out of stock</span>
            ) : (
              <span className="text-ink-500">
                {selectedVariant.availableStock <= 10
                  ? `Only ${selectedVariant.availableStock} left in stock`
                  : "In stock"}
              </span>
            )}
          </div>

          <div className="mt-6 flex items-center gap-4">
            <select
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              disabled={outOfStock}
              className="rounded-xl border border-ink-100 bg-white px-3 py-3 text-sm"
            >
              {Array.from({ length: Math.min(selectedVariant?.availableStock ?? 1, 10) }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={outOfStock}
              className="flex-1 rounded-full bg-cedar-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-cedar-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {outOfStock ? "Sold Out" : "Add to Cart"}
            </button>
          </div>

          {selectedVariant && (
            <p className="mt-4 text-xs text-ink-300">SKU: {selectedVariant.sku}</p>
          )}
        </div>
      </div>
    </div>
  );
}
