import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/api";
import { formatCents } from "@/lib/format";
import { ProductImagePlaceholder } from "./ProductImagePlaceholder";

export function ProductCard({ product }: { product: Product }) {
  const image = product.featuredImageUrl ?? product.imageUrl;
  const outOfStock = product.totalStock <= 0;

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-card transition-shadow hover:shadow-cardHover"
    >
      <div className="relative aspect-square overflow-hidden bg-cream-200">
        {image ? (
          <Image
            src={image}
            alt={product.title}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-contain p-4 transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <ProductImagePlaceholder />
        )}

        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {product.isOnSale && (
            <span className="rounded-full bg-cedar-600 px-2.5 py-1 text-xs font-semibold text-white">Sale</span>
          )}
          {product.isNew && !product.isOnSale && (
            <span className="rounded-full bg-ink-900 px-2.5 py-1 text-xs font-semibold text-white">New</span>
          )}
          {product.isBestSeller && (
            <span className="rounded-full bg-cream-50/95 px-2.5 py-1 text-xs font-semibold text-cedar-700">
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

      <div className="flex flex-1 flex-col gap-1 p-4">
        {product.category && (
          <span className="text-xs uppercase tracking-wide text-ink-500">{product.category.name}</span>
        )}
        <h3 className="line-clamp-2 font-serif text-base font-medium leading-snug text-ink-900">{product.title}</h3>
        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className="text-base font-semibold text-ink-900">{formatCents(product.basePriceCents, product.currency)}</span>
          {product.compareAtPriceCents && product.compareAtPriceCents > product.basePriceCents && (
            <span className="text-sm text-ink-300 line-through">
              {formatCents(product.compareAtPriceCents, product.currency)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
