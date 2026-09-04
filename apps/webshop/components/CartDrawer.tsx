"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { formatCents, isRenderableImageUrl } from "@/lib/format";
import { ProductImagePlaceholder } from "./ProductImagePlaceholder";
import { CartQuantitySelect } from "./CartQuantitySelect";

export function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, setQuantity, subtotalCents } = useCart();

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-ink-900/40 transition-opacity ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={closeCart}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-cream-50 shadow-cardHover transition-transform ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-5">
          <h2 className="font-serif text-lg font-semibold text-ink-900">Your Cart</h2>
          <button
            type="button"
            onClick={closeCart}
            aria-label="Close cart"
            className="text-2xl leading-none text-ink-500 hover:text-ink-900"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <p className="mt-10 text-center text-sm text-ink-500">Your cart is empty.</p>
          ) : (
            <ul className="flex flex-col gap-5">
              {items.map((item) => (
                <li key={item.variantId} className="flex gap-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-cream-200">
                    {isRenderableImageUrl(item.imageUrl) ? (
                      <Image src={item.imageUrl} alt={item.productTitle} fill className="object-contain p-1.5" />
                    ) : (
                      <ProductImagePlaceholder />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <Link href={`/product/${item.productSlug}`} onClick={closeCart} className="text-sm font-medium text-ink-900 hover:text-cedar-600">
                      {item.productTitle}
                    </Link>
                    {item.variantLabel && <span className="text-xs text-ink-500">{item.variantLabel}</span>}
                    <div className="mt-2 flex items-center gap-3">
                      <CartQuantitySelect
                        quantity={item.quantity}
                        availableStock={item.availableStock}
                        onChange={(quantity) => setQuantity(item.variantId, quantity)}
                        className="py-1"
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(item.variantId)}
                        className="text-xs font-medium text-ink-500 underline hover:text-cedar-600"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-ink-900">{formatCents(item.priceCents * item.quantity)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-ink-100 px-6 py-5">
            <div className="mb-4 flex items-center justify-between text-base font-semibold text-ink-900">
              <span>Subtotal</span>
              <span>{formatCents(subtotalCents)}</span>
            </div>
            <Link
              href="/cart"
              onClick={closeCart}
              className="block w-full rounded-full bg-cedar-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-cedar-700"
            >
              View Cart & Checkout
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
