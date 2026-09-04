"use client";

// A route-level error.tsx (unlike global-error.tsx) still renders inside
// the root layout — Header/Footer/CartDrawer stay mounted — so a fetch
// failure on one page doesn't take down cart access or navigation.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-3xl text-red-600">
        !
      </span>
      <h1 className="mt-6 font-serif text-2xl font-semibold text-ink-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-ink-500">
        We couldn&apos;t load this page. This is usually temporary — please try again.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-cedar-600 px-6 py-3 text-sm font-semibold text-white hover:bg-cedar-700"
        >
          Try Again
        </button>
        <a
          href="/"
          className="rounded-full border border-ink-200 px-6 py-3 text-sm font-semibold text-ink-900 hover:bg-cream-100"
        >
          Back to Home
        </a>
      </div>
    </div>
  );
}
