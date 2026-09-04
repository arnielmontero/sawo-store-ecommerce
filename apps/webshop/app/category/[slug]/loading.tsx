import { ProductGridSkeleton } from "@/components/ProductGridSkeleton";

export default function CategoryLoading() {
  return (
    <div className="mx-auto max-w-[1800px] px-4 py-10 sm:px-6 lg:px-10">
      <div className="mb-6 h-4 w-40 animate-pulse rounded bg-cream-200" />
      <div className="mb-8 h-8 w-56 animate-pulse rounded bg-cream-200" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">
        <div className="hidden h-96 animate-pulse rounded-2xl bg-cream-100 lg:block" />
        <ProductGridSkeleton />
      </div>
    </div>
  );
}
