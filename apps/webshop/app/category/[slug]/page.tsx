import { notFound } from "next/navigation";
import { fetchAllProducts, fetchCategoryTree, type Category, type ProductSortField, type SortDir } from "@/lib/api";
import { CategorySidebar } from "@/components/CategorySidebar";
import { FilterPanel } from "@/components/FilterPanel";
import { ProductGrid } from "@/components/ProductGrid";
import { SortControl } from "@/components/SortControl";
import { Breadcrumbs } from "@/components/Breadcrumbs";

function findCategory(categories: Category[], slug: string) {
  for (const category of categories) {
    if (category.slug === slug) return category;
    const child = category.children.find((c) => c.slug === slug);
    if (child) return child;
  }
  return null;
}

function findParent(categories: Category[], slug: string) {
  return categories.find((category) => category.children.some((c) => c.slug === slug)) ?? null;
}

const SORT_COMPARATORS: Record<string, (a: { basePriceCents: number; title: string }, b: { basePriceCents: number; title: string }) => number> = {
  "price-asc": (a, b) => a.basePriceCents - b.basePriceCents,
  "price-desc": (a, b) => b.basePriceCents - a.basePriceCents,
  "name-asc": (a, b) => a.title.localeCompare(b.title),
};

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: {
    minPrice?: string;
    maxPrice?: string;
    inStock?: string;
    onSale?: string;
    sortBy?: ProductSortField;
    sortDir?: SortDir;
  };
}) {
  const categories = await fetchCategoryTree();
  const category = findCategory(categories, params.slug);
  if (!category) notFound();
  const parent = findParent(categories, params.slug);

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

  // Sorted client-side after merging every child category's results — the
  // API's sortBy/sortDir only orders a single category's page, which would
  // be wrong once multiple child-category fetches are flattened together.
  if (searchParams.sortBy && searchParams.sortDir) {
    const key = `${searchParams.sortBy}-${searchParams.sortDir}`;
    const comparator = SORT_COMPARATORS[key];
    if (comparator) products = [...products].sort(comparator);
  }

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-10 sm:px-6 lg:px-10">
      <Breadcrumbs
        items={
          parent
            ? [{ label: parent.name, href: `/category/${parent.slug}` }, { label: category.name }]
            : [{ label: category.name }]
        }
      />

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink-900">{category.name}</h1>
          <p className="mt-2 text-sm text-ink-500">{products.length} products</p>
        </div>
        <SortControl />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">
        <div className="flex flex-col gap-6 self-start lg:sticky lg:top-24">
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
