import Link from "next/link";
import { trackOrder } from "@/lib/api";
import { formatCents } from "@/lib/format";

// Re-fetches the just-placed order from the API (rather than trusting only
// the ?ref query param) so this page shows the real, server-priced total
// and line items — the same order an admin sees in the backoffice, not a
// client-side echo of what the cart happened to say.
export default async function OrderConfirmationPage({ searchParams }: { searchParams: { ref?: string } }) {
  const order = searchParams.ref ? await trackOrder(searchParams.ref) : null;

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6 lg:px-8">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cedar-100 text-3xl text-cedar-600">
        ✓
      </span>
      <h1 className="mt-6 font-serif text-3xl font-semibold text-ink-900">Thank you for your order!</h1>
      {searchParams.ref && (
        <p className="mt-3 text-ink-500">
          Order reference <span className="font-semibold text-ink-900">{searchParams.ref}</span>
        </p>
      )}
      <p className="mt-4 text-sm text-ink-500">
        We&apos;ve received your order details. A member of our team will reach out to confirm shipping and payment.
      </p>

      {order && (
        <div className="mt-8 rounded-2xl bg-white p-6 text-left shadow-card">
          <ul className="flex flex-col gap-2 border-b border-ink-100 pb-4 text-sm text-ink-700">
            {order.items.map((item) => (
              <li key={item.sku} className="flex justify-between">
                <span className="line-clamp-1 pr-2">
                  {item.productTitle} × {item.quantity}
                </span>
                <span>{formatCents(item.unitPriceCents * item.quantity, order.currency)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between pt-4 text-base font-semibold text-ink-900">
            <span>Total</span>
            <span>{formatCents(order.totalCents, order.currency)}</span>
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        {searchParams.ref && (
          <Link
            href={`/track?ref=${encodeURIComponent(searchParams.ref)}`}
            className="inline-block rounded-full border border-ink-200 px-8 py-3 text-sm font-semibold text-ink-900 hover:bg-cream-100"
          >
            Track This Order
          </Link>
        )}
        <Link
          href="/shop"
          className="inline-block rounded-full bg-cedar-600 px-8 py-3 text-sm font-semibold text-white hover:bg-cedar-700"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
