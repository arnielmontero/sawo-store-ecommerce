import Link from "next/link";

// Catches both an explicit notFound() call (invalid product/category slug)
// and any unmatched route. Renders inside the root layout (Header/Footer
// still show) since this isn't a root-level crash — just a missing page.
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8">
      <span className="font-serif text-6xl font-semibold text-cedar-300">404</span>
      <h1 className="mt-4 font-serif text-2xl font-semibold text-ink-900">Page not found</h1>
      <p className="mt-2 text-sm text-ink-500">
        The page you&apos;re looking for doesn&apos;t exist, or the product may no longer be available.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/shop"
          className="rounded-full bg-cedar-600 px-6 py-3 text-sm font-semibold text-white hover:bg-cedar-700"
        >
          Browse All Products
        </Link>
        <Link
          href="/"
          className="rounded-full border border-ink-200 px-6 py-3 text-sm font-semibold text-ink-900 hover:bg-cream-100"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
