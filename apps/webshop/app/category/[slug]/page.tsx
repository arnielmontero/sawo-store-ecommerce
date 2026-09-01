import { notFound } from "next/navigation";
import { fetchAllProducts, fetchCategoryTree } from "@/lib/api";
import { CategorySidebar } from "@/components/CategorySidebar";
import { FilterPanel } from "@/components/FilterPanel";
import { ProductGrid } from "@/components/ProductGrid";

function findCategory(categories: Awaited<ReturnType<typeof fetchCategoryTree>>, slug: string) {
  for (const category of categories) {
    if (category.slug === slug) return category;
    const child = category.children.find((c) => c.slug === slug);
    if (child) return child;
  }
  return null;
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { minPrice?: string; maxPrice?: string; inStock?: string; onSale?: string };
}) {
  const categories = await fetchCategoryTree();
  const category = findCategory(categories, params.slug);
  if (!category) notFound();

  // A parent category (e.g. "Sauna Accessories") has no products of its own
  // — only its children do — so fetch every descendant slug's products and
  // merge them; a leaf category just fetches its own slug. Each fetch walks
  // every page of that slug's results (fetchAllProducts), not just the
  // first 20, so a category never silently truncates the admin's catalog.
  const slugsToFetch = category.children.length > 0 ? category.children.map((c) => c.slug) : [category.slug];
  const productLists = await Promise.all(
    slugsToFetch.map((slug) =>
      fetchAllProducts({
        category: slug,
        minPrice: searchParams.minPrice ? Number(searchParams.minPrice) : undefined,
        maxPrice: searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined,
      })
    )
  );
  let products = productLists.flat();
  if (searchParams.inStock === "1") products = products.filter((p) => p.totalStock > 0);
  if (searchParams.onSale === "1") products = products.filter((p) => p.isOnSale);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-semibold text-ink-900">{category.name}</h1>
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
