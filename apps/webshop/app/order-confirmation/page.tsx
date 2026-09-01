import Link from "next/link";

export default function OrderConfirmationPage({ searchParams }: { searchParams: { ref?: string } }) {
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
      <Link
        href="/shop"
        className="mt-8 inline-block rounded-full bg-cedar-600 px-8 py-3 text-sm font-semibold text-white hover:bg-cedar-700"
      >
        Continue Shopping
      </Link>
    </div>
  );
}
