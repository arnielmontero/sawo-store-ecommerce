import { fetchAllProducts, fetchCategoryTree } from "@/lib/api";
import { CategorySidebar } from "@/components/CategorySidebar";
import { FilterPanel } from "@/components/FilterPanel";
import { ProductGrid } from "@/components/ProductGrid";

export default async function ShopPage({
  searchParams,
}: {
  searchParams: { minPrice?: string; maxPrice?: string; inStock?: string; onSale?: string; sortBy?: string };
}) {
  const [categories, allProducts] = await Promise.all([
    fetchCategoryTree(),
    fetchAllProducts({
      minPrice: searchParams.minPrice ? Number(searchParams.minPrice) : undefined,
      maxPrice: searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined,
    }),
  ]);

  let products = allProducts;
  if (searchParams.inStock === "1") products = products.filter((p) => p.totalStock > 0);
  if (searchParams.onSale === "1") products = products.filter((p) => p.isOnSale);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-semibold text-ink-900">All Products</h1>
        <p className="mt-2 text-sm text-ink-500">{products.length} products</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">
        <div className="flex flex-col gap-6">
          <CategorySidebar categories={categories} />
          <FilterPanel
            minPrice={searchParams.minPrice ? Number(searchParams.minPrice) / 100 : 0}
            maxPrice={searchParams.maxPrice ? Number(searchParams.maxPrice) / 100 : 1500}
          />
        </div>
        <ProductGrid products={products} />
      </div>
    </div>
  );
}
