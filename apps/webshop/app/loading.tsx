import { ProductGridSkeleton } from "@/components/ProductGridSkeleton";

// Root loading.tsx — only the homepage sits directly at app/page.tsx, every
// other route has its own more specific loading.tsx that takes precedence.
export default function HomeLoading() {
  return (
    <div>
      <div className="h-[420px] animate-pulse bg-ink-900/10" />
      <div className="mx-auto max-w-[1800px] px-4 py-16 sm:px-6 lg:px-10">
        <div className="mb-8 h-7 w-48 animate-pulse rounded bg-cream-200" />
        <ProductGridSkeleton count={10} />
      </div>
    </div>
  );
}
