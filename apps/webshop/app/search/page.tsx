import { fetchAllProducts } from "@/lib/api";
import { ProductGrid } from "@/components/ProductGrid";

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const query = searchParams.q?.trim() ?? "";
  const products = query ? await fetchAllProducts({ search: query }) : null;

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-10 sm:px-6 lg:px-10">
      <h1 className="font-serif text-3xl font-semibold text-ink-900">
        {query ? `Results for "${query}"` : "Search"}
      </h1>
      <p className="mt-2 text-sm text-ink-500">
        {query ? `${products?.length ?? 0} products found` : "Enter a search term to find products."}
      </p>
      <div className="mt-8">{products && <ProductGrid products={products} />}</div>
    </div>
  );
}
