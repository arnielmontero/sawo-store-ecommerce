"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { formatCents } from "@/lib/format";
import {
  placeOrder,
  validateCoupon,
  fetchShippingQuote,
  type CouponPreview,
  type PaymentMethod,
  type ShippingQuote,
} from "@/lib/api";
import { COUNTRIES } from "@/lib/countries";

// Places a REAL order: POST /api/orders/checkout creates a PENDING Order,
// reserves stock, and is immediately visible in the admin backoffice. What
// is not yet real is the money — no Stripe/PayPal charge happens, so the
// order lands in PENDING for staff to confirm, exactly like the existing
// Pay by Check / Bank Transfer flows already work in admin.
export default function CheckoutPage() {
  const { items, subtotalCents, clear } = useCart();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CARD");

  const [couponCode, setCouponCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponPreview | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("US");

  const [shippingQuote, setShippingQuote] = useState<ShippingQuote | null>(null);
  const [shippingQuoteLoading, setShippingQuoteLoading] = useState(false);

  const cartItemsForQuote = items.map((item) => ({ variantId: item.variantId, quantity: item.quantity }));
  const addressComplete = Boolean(addressLine1.trim() && city.trim() && region.trim() && postalCode.trim());

  // Early estimate — fires as soon as a country is picked, using a
  // representative city for that country server-side (see
  // lib/shippingQuote.ts) rather than the customer's real address, which
  // isn't complete yet at this point. Debounced since cart quantity changes
  // also re-trigger this.
  useEffect(() => {
    if (!country || addressComplete) return;
    const timer = setTimeout(() => {
      setShippingQuoteLoading(true);
      fetchShippingQuote({ items: cartItemsForQuote, shippingCountry: country })
        .then(setShippingQuote)
        .catch(() => setShippingQuote(null)) // never block checkout on a quote failure
        .finally(() => setShippingQuoteLoading(false));
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, addressComplete, items.length]);

  // Final, fully accurate quote — fires once every address field is
  // filled in, replacing the early estimate with a real quote for the
  // exact destination before the customer can pay.
  useEffect(() => {
    if (!addressComplete || !country) return;
    const timer = setTimeout(() => {
      setShippingQuoteLoading(true);
      fetchShippingQuote({
        items: cartItemsForQuote,
        shippingCountry: country,
        address: { street1: addressLine1.trim(), city: city.trim(), state: region.trim(), postalCode: postalCode.trim() },
      })
        .then(setShippingQuote)
        .catch(() => {}) // keep showing the last-known estimate rather than clearing it on failure
        .finally(() => setShippingQuoteLoading(false));
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressComplete, addressLine1, city, region, postalCode, country, items.length]);

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    setApplying(true);
    setCouponError(null);
    try {
      const preview = await validateCoupon(
        couponCode.trim(),
        cartItemsForQuote,
        country,
        addressComplete
          ? { street1: addressLine1.trim(), city: city.trim(), state: region.trim(), postalCode: postalCode.trim() }
          : undefined
      );
      setAppliedCoupon(preview);
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err instanceof Error ? err.message : "Failed to apply coupon.");
    } finally {
      setApplying(false);
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError(null);
  }

  // appliedCoupon.totalCents already includes server-computed shipping
  // (validateCoupon now sends country/address, see handleApplyCoupon), so
  // shipping is only added client-side when no coupon has been applied —
  // the authoritative total is always recomputed server-side in
  // checkout() regardless of what's displayed here.
  const displayTotalCents = appliedCoupon
    ? appliedCoupon.totalCents
    : subtotalCents + (shippingQuote?.shippingCents ?? 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      // Order has no dedicated name/email/phone columns (no storefront
      // signup flow exists — see the User model's comment), only
      // shippingAddress as free text, same as the admin's own manual-order
      // entry uses it. Newlines render correctly in admin (whitespace-pre-line
      // on the order detail page), so this stays legible to staff there.
      const shippingAddress = [
        fullName,
        `${addressLine1}${addressLine2 ? `, ${addressLine2}` : ""}`,
        `${city}, ${region} ${postalCode}`,
        `Phone: ${phone}`,
        `Email: ${email}`,
      ]
        .filter(Boolean)
        .join("\n");
      const order = await placeOrder({
        items: items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
        paymentMethod,
        shippingAddress,
        shippingCountry: country,
        shippingAddressStructured: { street1: addressLine1.trim(), city: city.trim(), state: region.trim(), postalCode: postalCode.trim() },
        couponCode: appliedCoupon?.appliedCoupon?.code,
      });
      clear();
      router.push(`/order-confirmation?ref=${order.reference}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong placing your order. Please try again."
      );
      setSubmitting(false);
    }
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
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-10">
      <h1 className="mb-2 font-serif text-3xl font-semibold text-ink-900">Checkout</h1>
      <p className="mb-8 text-sm text-ink-500">
        Your order is placed and sent to our team right away. Online card payment isn&apos;t live yet, so we&apos;ll
        follow up by email to confirm payment before shipping.
      </p>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-8">
          <fieldset className="rounded-2xl bg-white p-6 shadow-card">
            <legend className="mb-4 font-serif text-lg font-semibold text-ink-900">Contact Information</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <input
                required
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full Name"
                className="rounded-xl border border-ink-100 px-4 py-3 text-sm"
              />
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
                className="rounded-xl border border-ink-100 px-4 py-3 text-sm"
              />
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone Number"
                className="rounded-xl border border-ink-100 px-4 py-3 text-sm sm:col-span-2"
              />
            </div>
          </fieldset>

          <fieldset className="rounded-2xl bg-white p-6 shadow-card">
            <legend className="mb-4 font-serif text-lg font-semibold text-ink-900">Shipping Address</legend>
            {shippingQuote?.isSandbox && (
              <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Test mode — any address works here and shipping quotes are from a sandbox account, not real charges.
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <input
                required
                type="text"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="Address Line 1"
                className="rounded-xl border border-ink-100 px-4 py-3 text-sm sm:col-span-2"
              />
              <input
                type="text"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="Address Line 2 (optional)"
                className="rounded-xl border border-ink-100 px-4 py-3 text-sm sm:col-span-2"
              />
              <input
                required
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="rounded-xl border border-ink-100 px-4 py-3 text-sm"
              />
              <input
                required
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="State / Province"
                className="rounded-xl border border-ink-100 px-4 py-3 text-sm"
              />
              <input
                required
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="Postal Code"
                className="rounded-xl border border-ink-100 px-4 py-3 text-sm"
              />
              <select
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="rounded-xl border border-ink-100 px-4 py-3 text-sm"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>

          <fieldset className="rounded-2xl bg-white p-6 shadow-card">
            <legend className="mb-4 font-serif text-lg font-semibold text-ink-900">Payment Method</legend>
            <p className="mb-4 text-sm text-ink-500">
              Card payment isn&apos;t wired up yet — choose how you&apos;d like to settle payment and our team will
              follow up to confirm it before shipping.
            </p>
            <div className="flex flex-col gap-2">
              {(
                [
                  { value: "CARD", label: "Card (confirmed by phone/email)" },
                  { value: "PAYPAL", label: "PayPal" },
                  { value: "BANK", label: "Bank Transfer" },
                  { value: "PAY_WITH_CHECK", label: "Pay by Check" },
                ] as { value: PaymentMethod; label: string }[]
              ).map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                    paymentMethod === option.value
                      ? "border-cedar-500 bg-cedar-50/60 text-ink-900"
                      : "border-ink-100 text-ink-700 hover:border-cedar-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={option.value}
                    checked={paymentMethod === option.value}
                    onChange={() => setPaymentMethod(option.value)}
                    className="accent-cedar-600"
                  />
                  {option.label}
                </label>
              ))}
            </div>
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
          <div className="border-t border-ink-100 pt-4">
            {appliedCoupon ? (
              <div className="mb-3 flex items-center justify-between rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                <span>
                  Code <strong className="font-mono">{appliedCoupon.appliedCoupon?.code}</strong> applied
                </span>
                <button type="button" onClick={handleRemoveCoupon} className="text-xs font-medium underline">
                  Remove
                </button>
              </div>
            ) : (
              <div className="mb-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Promo code"
                    className="min-w-0 flex-1 rounded-xl border border-ink-100 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={applying || !couponCode.trim()}
                    className="shrink-0 rounded-xl border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {applying ? "Applying…" : "Apply"}
                  </button>
                </div>
                {couponError && <p className="mt-1 text-xs text-red-600">{couponError}</p>}
              </div>
            )}

            {appliedCoupon && appliedCoupon.discountCents > 0 && (
              <div className="mb-1 flex items-center justify-between text-sm text-ink-500">
                <span>Discount</span>
                <span>-{formatCents(appliedCoupon.discountCents)}</span>
              </div>
            )}
            <div className="mb-1 flex items-center justify-between text-sm text-ink-500">
              <span>Shipping</span>
              {shippingQuoteLoading && !appliedCoupon ? (
                <span>Calculating…</span>
              ) : (
                <span>
                  {formatCents(appliedCoupon ? appliedCoupon.shippingCents : shippingQuote?.shippingCents ?? 0)}
                  {(appliedCoupon ? appliedCoupon.isShippingEstimate : shippingQuote?.isEstimate) && (
                    <span className="ml-1 text-xs text-ink-400">(estimated)</span>
                  )}
                </span>
              )}
            </div>
            {!addressComplete && (
              <p className="mb-3 text-xs text-ink-400">
                Shipping is estimated from your country until your full address is entered below.
              </p>
            )}
            <div className="flex items-center justify-between text-base font-semibold text-ink-900">
              <span>Total</span>
              <span>{formatCents(displayTotalCents)}</span>
            </div>
          </div>
          {submitError && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p>
          )}
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
