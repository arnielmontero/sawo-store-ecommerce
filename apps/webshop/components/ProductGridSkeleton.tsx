// Mirrors ProductGrid's exact column breakpoints so the loading state
// doesn't visibly reflow into a different layout once real data arrives.
export function ProductGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading products"
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 xl:grid-cols-4 2xl:grid-cols-5"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col overflow-hidden rounded-xl border border-ink-100/60 bg-white">
          <div className="aspect-square animate-pulse bg-cream-200" />
          <div className="flex flex-col gap-2 p-3.5">
            <div className="h-3 w-1/3 animate-pulse rounded bg-cream-200" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-cream-200" />
            <div className="h-5 w-1/2 animate-pulse rounded bg-cream-200" />
          </div>
        </div>
      ))}
    </div>
  );
}
