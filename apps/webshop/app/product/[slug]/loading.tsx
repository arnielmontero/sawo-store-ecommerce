export default function ProductLoading() {
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:px-10">
      <div className="mb-6 h-4 w-64 animate-pulse rounded bg-cream-200" />
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,460px)_1fr]">
        <div className="aspect-square animate-pulse rounded-2xl bg-cream-200" />
        <div className="flex flex-col gap-3">
          <div className="h-4 w-24 animate-pulse rounded bg-cream-200" />
          <div className="h-8 w-3/4 animate-pulse rounded bg-cream-200" />
          <div className="h-4 w-32 animate-pulse rounded bg-cream-200" />
          <div className="mt-4 h-8 w-40 animate-pulse rounded bg-cream-200" />
          <div className="mt-6 h-24 w-full animate-pulse rounded bg-cream-200" />
          <div className="mt-6 h-12 w-full animate-pulse rounded-full bg-cream-200" />
        </div>
      </div>
    </div>
  );
}
