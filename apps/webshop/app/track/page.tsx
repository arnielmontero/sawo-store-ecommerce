import Link from "next/link";
import { trackOrder } from "@/lib/api";
import { formatCents } from "@/lib/format";
import { TrackOrderForm } from "@/components/TrackOrderForm";
import { OrderTimeline } from "@/components/OrderTimeline";

export default async function TrackPage({ searchParams }: { searchParams: { ref?: string } }) {
  const reference = searchParams.ref?.trim();
  const order = reference ? await trackOrder(reference) : null;
  const notFound = !!reference && !order;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-serif text-3xl font-semibold text-ink-900">Track Your Order</h1>
      <p className="mt-2 text-sm text-ink-500">
        Enter the order reference from your confirmation email or receipt.
      </p>

      <div className="mt-6">
        <TrackOrderForm initialValue={reference} />
      </div>

      {notFound && (
        <div className="mt-8 rounded-2xl border border-dashed border-ink-100 p-6 text-center text-sm text-ink-500">
          We couldn&apos;t find an order with reference <span className="font-semibold text-ink-900">{reference}</span>.
          Double-check the reference and try again.
        </div>
      )}

      {order && (
        <div className="mt-8 flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white p-6 shadow-card">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-500">Order Reference</p>
              <p className="font-serif text-xl font-semibold text-ink-900">{order.reference}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-ink-500">Placed</p>
              <p className="text-sm text-ink-900">
                {new Date(order.placedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          <OrderTimeline status={order.status} timeline={order.timeline} />

          {(order.trackingNumber || order.carrier) && (
            <div className="rounded-2xl bg-white p-6 shadow-card">
              <h2 className="mb-3 font-serif text-lg font-semibold text-ink-900">Shipping</h2>
              <dl className="flex flex-col gap-2 text-sm">
                {order.carrier && (
                  <div className="flex justify-between">
                    <dt className="text-ink-500">Carrier</dt>
                    <dd className="font-medium text-ink-900">{order.carrier}</dd>
                  </div>
                )}
                {order.trackingNumber && (
                  <div className="flex justify-between">
                    <dt className="text-ink-500">Tracking Number</dt>
                    <dd className="font-medium text-ink-900">{order.trackingNumber}</dd>
                  </div>
                )}
                {order.deliveryStatus && (
                  <div className="flex justify-between">
                    <dt className="text-ink-500">Carrier Status</dt>
                    <dd className="font-medium text-ink-900">{order.deliveryStatus}</dd>
                  </div>
                )}
              </dl>
              {order.trackingUrl && (
                <a
                  href={order.trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-block text-sm font-medium text-cedar-600 hover:underline"
                >
                  View on carrier&apos;s site →
                </a>
              )}
            </div>
          )}

          <div className="rounded-2xl bg-white p-6 shadow-card">
            <h2 className="mb-4 font-serif text-lg font-semibold text-ink-900">Order Summary</h2>
            <ul className="flex flex-col gap-2 border-b border-ink-100 pb-4 text-sm text-ink-700">
              {order.items.map((item) => (
                <li key={item.sku} className="flex justify-between">
                  <span className="pr-2">
                    <Link href={`/product/${item.productSlug}`} className="hover:text-cedar-600">
                      {item.productTitle}
                    </Link>{" "}
                    × {item.quantity}
                  </span>
                  <span>{formatCents(item.unitPriceCents * item.quantity, order.currency)}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-1 pt-4 text-sm text-ink-500">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCents(order.subtotalCents, order.currency)}</span>
              </div>
              {order.discountCents > 0 && (
                <div className="flex justify-between">
                  <span>Discount</span>
                  <span>-{formatCents(order.discountCents, order.currency)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>{formatCents(order.shippingCents, order.currency)}</span>
              </div>
              {order.taxCents > 0 && (
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>{formatCents(order.taxCents, order.currency)}</span>
                </div>
              )}
              <div className="mt-2 flex justify-between border-t border-ink-100 pt-2 text-base font-semibold text-ink-900">
                <span>Total</span>
                <span>{formatCents(order.totalCents, order.currency)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
