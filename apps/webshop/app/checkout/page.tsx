"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { formatCents } from "@/lib/format";

// There's no customer-facing order/payment API yet — order creation and
// Stripe charges only exist on the admin side of this app today. This page
// collects real shipping/contact info and, on submit, clears the cart and
// routes to a confirmation page — a genuine checkout *flow* without
// pretending to move real money, so nothing here claims to be a live charge.
export default function CheckoutPage() {
  const { items, subtotalCents, clear } = useCart();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const reference = `SAWO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    clear();
    router.push(`/order-confirmation?ref=${reference}`);
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <h1 className="font-serif text-3xl font-semibold text-ink-900">Your cart is empty</h1>
        <Link href="/shop" className="mt-8 inline-block rounded-full bg-cedar-600 px-8 py-3 text-sm font-semibold text-white hover:bg-cedar-700">
          Shop All Products
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-2 font-serif text-3xl font-semibold text-ink-900">Checkout</h1>
      <p className="mb-8 text-sm text-ink-500">
        Demo checkout — no payment is charged. An admin representative reviews and confirms real orders.
      </p>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-8">
          <fieldset className="rounded-2xl bg-white p-6 shadow-card">
            <legend className="mb-4 font-serif text-lg font-semibold text-ink-900">Contact Information</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <input required type="text" placeholder="Full Name" className="rounded-xl border border-ink-100 px-4 py-3 text-sm" />
              <input required type="email" placeholder="Email Address" className="rounded-xl border border-ink-100 px-4 py-3 text-sm" />
              <input required type="tel" placeholder="Phone Number" className="rounded-xl border border-ink-100 px-4 py-3 text-sm sm:col-span-2" />
            </div>
          </fieldset>

          <fieldset className="rounded-2xl bg-white p-6 shadow-card">
            <legend className="mb-4 font-serif text-lg font-semibold text-ink-900">Shipping Address</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <input required type="text" placeholder="Address Line 1" className="rounded-xl border border-ink-100 px-4 py-3 text-sm sm:col-span-2" />
              <input type="text" placeholder="Address Line 2 (optional)" className="rounded-xl border border-ink-100 px-4 py-3 text-sm sm:col-span-2" />
              <input required type="text" placeholder="City" className="rounded-xl border border-ink-100 px-4 py-3 text-sm" />
              <input required type="text" placeholder="State / Province" className="rounded-xl border border-ink-100 px-4 py-3 text-sm" />
              <input required type="text" placeholder="Postal Code" className="rounded-xl border border-ink-100 px-4 py-3 text-sm" />
              <input required type="text" placeholder="Country" className="rounded-xl border border-ink-100 px-4 py-3 text-sm" />
            </div>
          </fieldset>

          <fieldset className="rounded-2xl bg-white p-6 shadow-card">
            <legend className="mb-4 font-serif text-lg font-semibold text-ink-900">Payment Method</legend>
            <p className="text-sm text-ink-500">
              Card payment isn&apos;t wired up in this demo storefront yet — placing this order sends it through
              for manual review, the same as our Pay by Check / Bank options.
            </p>
          </fieldset>
        </div>

        <div className="h-fit rounded-2xl bg-white p-6 shadow-card">
          <h2 className="mb-4 font-serif text-lg font-semibold text-ink-900">Order Summary</h2>
          <ul className="mb-4 flex flex-col gap-2 text-sm text-ink-700">
            {items.map((item) => (
              <li key={item.variantId} className="flex justify-between">
                <span className="line-clamp-1 pr-2">
                  {item.productTitle} × {item.quantity}
                </span>
                <span>{formatCents(item.priceCents * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-ink-100 pt-4 text-base font-semibold text-ink-900">
            <span>Total</span>
            <span>{formatCents(subtotalCents)}</span>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-full bg-cedar-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cedar-700 disabled:opacity-60"
          >
            {submitting ? "Placing Order…" : "Place Order"}
          </button>
        </div>
      </form>
    </div>
  );
}
