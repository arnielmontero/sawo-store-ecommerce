"use client";

import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/api";
import { formatCents } from "@/lib/format";
import { ProductImagePlaceholder } from "./ProductImagePlaceholder";
import { StarRating } from "./StarRating";
import { useCart } from "@/context/CartContext";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const image = product.featuredImageUrl ?? product.imageUrl;
  const outOfStock = product.totalStock <= 0;
  const lowStock = !outOfStock && product.totalStock <= 5;
  const hasDiscount = !!product.compareAtPriceCents && product.compareAtPriceCents > product.basePriceCents;
  const percentOff = hasDiscount
    ? Math.round(100 - (product.basePriceCents / product.compareAtPriceCents!) * 100)
    : 0;

  // A grid card only has room for a one-click add, not a variant picker —
  // so quick-add is offered exclusively when there's nothing to choose.
  // Multi-variant products (most sauna heaters/doors have size or power
  // options) still route to the PDP to pick a variant, same as before.
  const singleVariant = product.variants.length === 1 ? product.variants[0] : null;
  const availableStock = singleVariant?.inventory
    ? singleVariant.inventory.stockQuantity - singleVariant.inventory.reservedQuantity
    : 0;
  const canQuickAdd = !outOfStock && singleVariant != null && availableStock > 0;

  function handleQuickAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!singleVariant) return;
    addItem({
      variantId: singleVariant.id,
      productSlug: product.slug,
      productTitle: product.title,
      variantLabel: null,
      imageUrl: image ?? null,
      priceCents: singleVariant.priceCents,
      availableStock,
    });
  }

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-ink-100/60 bg-white transition-all hover:-translate-y-0.5 hover:border-cedar-200 hover:shadow-cardHover"
    >
      <div className="relative aspect-square overflow-hidden bg-cream-100">
        {image ? (
          <Image
            src={image}
            alt={product.title}
            fill
            sizes="(min-width: 1536px) 20vw, (min-width: 1280px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-contain p-3 transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <ProductImagePlaceholder />
        )}

        <div className="absolute left-2.5 top-2.5 flex flex-col gap-1.5">
          {hasDiscount && (
            <span className="rounded-md bg-cedar-600 px-2 py-0.5 text-xs font-bold text-white">-{percentOff}%</span>
          )}
          {product.isNew && !hasDiscount && (
            <span className="rounded-md bg-ink-900 px-2 py-0.5 text-xs font-semibold text-white">New</span>
          )}
          {product.isBestSeller && (
            <span className="rounded-md bg-cream-50/95 px-2 py-0.5 text-xs font-semibold text-cedar-700 ring-1 ring-inset ring-cedar-200">
              Best Seller
            </span>
          )}
        </div>

        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink-900/40">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink-900">Sold Out</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3.5">
        {product.category && (
          <span className="text-[11px] font-medium uppercase tracking-wide text-ink-500">{product.category.name}</span>
        )}
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-ink-900 group-hover:text-cedar-700">
          {product.title}
        </h3>

        <StarRating rating={product.rating} reviewCount={product.reviewCount} />

        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className={`text-lg font-semibold ${hasDiscount ? "text-cedar-600" : "text-ink-900"}`}>
            {formatCents(product.basePriceCents, product.currency)}
          </span>
          {hasDiscount && (
            <span className="text-sm text-ink-300 line-through">
              {formatCents(product.compareAtPriceCents!, product.currency)}
            </span>
          )}
        </div>

        <div className="flex h-4 items-center text-xs">
          {outOfStock ? (
            <span className="font-medium text-ink-300">Out of stock</span>
          ) : lowStock ? (
            <span className="font-medium text-cedar-600">Only {product.totalStock} left</span>
          ) : (
            <span className="text-ink-500">In stock</span>
          )}
        </div>

        {canQuickAdd ? (
          <button
            type="button"
            onClick={handleQuickAdd}
            className="mt-2 w-full rounded-full border border-cedar-600 py-2 text-xs font-semibold text-cedar-700 transition-colors hover:bg-cedar-600 hover:text-white"
          >
            Add to Cart
          </button>
        ) : (
          !outOfStock && (
            <span className="mt-2 block text-center text-xs font-medium text-ink-500">Select Options</span>
          )
        )}
      </div>
    </Link>
  );
}
