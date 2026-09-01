"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { formatCents, isRenderableImageUrl } from "@/lib/format";
import { ProductImagePlaceholder } from "@/components/ProductImagePlaceholder";

export default function CartPage() {
  const { items, removeItem, setQuantity, subtotalCents } = useCart();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <h1 className="font-serif text-3xl font-semibold text-ink-900">Your cart is empty</h1>
        <p className="mt-3 text-ink-500">Browse the shop to find something for your sauna.</p>
        <Link
          href="/shop"
          className="mt-8 inline-block rounded-full bg-cedar-600 px-8 py-3 text-sm font-semibold text-white hover:bg-cedar-700"
        >
          Shop All Products
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-8 font-serif text-3xl font-semibold text-ink-900">Your Cart</h1>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
        <ul className="flex flex-col gap-6">
          {items.map((item) => (
            <li key={item.variantId} className="flex gap-4 rounded-2xl bg-white p-4 shadow-card">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-cream-200">
                {isRenderableImageUrl(item.imageUrl) ? (
                  <Image src={item.imageUrl} alt={item.productTitle} fill className="object-contain p-2" />
                ) : (
                  <ProductImagePlaceholder />
                )}
              </div>
              <div className="flex flex-1 flex-col">
                <Link href={`/product/${item.productSlug}`} className="font-medium text-ink-900 hover:text-cedar-600">
                  {item.productTitle}
                </Link>
                {item.variantLabel && <span className="text-sm text-ink-500">{item.variantLabel}</span>}
                <div className="mt-auto flex items-center gap-4 pt-2">
                  <select
                    value={item.quantity}
                    onChange={(e) => setQuantity(item.variantId, Number(e.target.value))}
                    className="rounded-lg border border-ink-100 bg-white px-2 py-1.5 text-sm"
                  >
                    {Array.from({ length: Math.max(item.quantity, Math.min(item.availableStock, 10)) }, (_, i) => i + 1).map(
                      (n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      )
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeItem(item.variantId)}
                    className="text-sm font-medium text-ink-500 underline hover:text-cedar-600"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <span className="font-semibold text-ink-900">{formatCents(item.priceCents * item.quantity)}</span>
            </li>
          ))}
        </ul>

        <div className="h-fit rounded-2xl bg-white p-6 shadow-card">
          <h2 className="mb-4 font-serif text-lg font-semibold text-ink-900">Order Summary</h2>
          <div className="flex items-center justify-between text-sm text-ink-700">
            <span>Subtotal</span>
            <span>{formatCents(subtotalCents)}</span>
          </div>
          <p className="mt-2 text-xs text-ink-300">Shipping and taxes calculated at checkout.</p>
          <Link
            href="/checkout"
            className="mt-6 block w-full rounded-full bg-cedar-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-cedar-700"
          >
            Proceed to Checkout
          </Link>
        </div>
      </div>
    </div>
  );
}
