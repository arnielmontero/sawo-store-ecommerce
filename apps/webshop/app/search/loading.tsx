import { ProductGridSkeleton } from "@/components/ProductGridSkeleton";

export default function SearchLoading() {
  return (
    <div className="mx-auto max-w-[1800px] px-4 py-10 sm:px-6 lg:px-10">
      <div className="h-8 w-64 animate-pulse rounded bg-cream-200" />
      <div className="mt-2 h-4 w-40 animate-pulse rounded bg-cream-200" />
      <div className="mt-8">
        <ProductGridSkeleton />
      </div>
    </div>
  );
}
