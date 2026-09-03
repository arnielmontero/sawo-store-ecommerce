import Image from "next/image";
import Link from "next/link";
import { fetchAllProducts, fetchCategoryTree, type Product } from "@/lib/api";
import { ProductGrid } from "@/components/ProductGrid";
import { formatCents } from "@/lib/format";

// The hero picks a random product below — without this, Next's Full Route
// Cache would render the page once and serve that same static HTML (same
// random pick) to every visitor until the next rebuild, defeating the
// randomization entirely. Forcing dynamic rendering makes Math.random() run
// fresh on every request.
export const dynamic = "force-dynamic";

// Flattens the category tree to every leaf (a parent like "Sauna
// Accessories" has no products of its own — only its children do), so each
// homepage tile can show a real product photo instead of a generic icon.
// Empty leaves (no products yet, e.g. a category with no admin-added items)
// are dropped — nothing to click through to.
function leafCategories(categories: Awaited<ReturnType<typeof fetchCategoryTree>>) {
  return categories
    .flatMap((category) => (category.children.length > 0 ? category.children : [category]))
    .filter((category) => category._count.products > 0);
}

export default async function HomePage() {
  const categories = await fetchCategoryTree();
  const leaves = leafCategories(categories);

  const [allProducts, categoryPreviewLists] = await Promise.all([
    fetchAllProducts({ sortBy: "createdAt", sortDir: "desc" }),
    Promise.all(leaves.map((c) => fetchAllProducts({ category: c.slug }))),
  ]);

  const bestSellers = allProducts.filter((p) => p.isBestSeller).slice(0, 4);
  const newArrivals = allProducts.slice(0, 8);
  const onSale = allProducts.filter((p) => p.isOnSale);

  // The hero leads with a real deal or bestseller — actual merchandising,
  // not a generic mood banner — falling back to the newest product if
  // nothing is currently on sale or flagged a bestseller. Picked randomly
  // within whichever pool is used so a repeat visit (or the periodic
  // revalidation) doesn't always spotlight the exact same item.
  const heroPool = onSale.length > 0 ? onSale : bestSellers.length > 0 ? bestSellers : allProducts;
  const heroProduct: Product | undefined = heroPool[Math.floor(Math.random() * heroPool.length)];
  const heroIsOnSale = heroPool === onSale;

  const categoryPreviews = leaves.map((category, i) => ({
    category,
    image: categoryPreviewLists[i].find((p) => p.featuredImageUrl)?.featuredImageUrl ?? null,
  }));

  return (
    <div>
      {heroProduct && (
        <section className="relative overflow-hidden bg-ink-900">
          <div className="mx-auto grid max-w-[1800px] grid-cols-1 lg:grid-cols-2">
            <div className="flex flex-col justify-center px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
              <span className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-cedar-200">
                {heroIsOnSale ? "Limited-Time Deal" : "Featured This Week"}
              </span>
              <h1 className="max-w-lg font-serif text-4xl font-semibold leading-tight text-white sm:text-5xl">
                {heroProduct.title}
              </h1>
              {heroProduct.description && (
                <p className="mt-4 max-w-md text-cream-100/80">{heroProduct.description}</p>
              )}
              <div className="mt-6 flex items-baseline gap-3">
                <span className="text-3xl font-semibold text-white">
                  {formatCents(heroProduct.basePriceCents, heroProduct.currency)}
                </span>
                {heroProduct.compareAtPriceCents && heroProduct.compareAtPriceCents > heroProduct.basePriceCents && (
                  <span className="text-lg text-cream-100/50 line-through">
                    {formatCents(heroProduct.compareAtPriceCents, heroProduct.currency)}
                  </span>
                )}
              </div>
              <Link
                href={`/product/${heroProduct.slug}`}
                className="mt-8 w-fit rounded-full bg-cedar-500 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-cedar-600"
              >
                Shop This Deal
              </Link>
            </div>
            <div className="relative min-h-[280px] bg-cream-100 lg:min-h-[420px]">
              {heroProduct.featuredImageUrl ? (
                <Image
                  src={heroProduct.featuredImageUrl}
                  alt={heroProduct.title}
                  fill
                  priority
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-contain p-12"
                />
              ) : null}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-[1800px] px-4 py-16 sm:px-6 lg:px-10">
        <h2 className="mb-8 font-serif text-2xl font-semibold text-ink-900">Shop by Category</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-6">
          {categoryPreviews.map(({ category, image }) => (
            <Link
              key={category.id}
              href={`/category/${category.slug}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-ink-100/60 bg-white transition-all hover:-translate-y-0.5 hover:border-cedar-200 hover:shadow-cardHover"
            >
              <div className="relative aspect-square bg-cream-100">
                {image ? (
                  <Image
                    src={image}
                    alt={category.name}
                    fill
                    sizes="200px"
                    className="object-contain p-5 transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center font-serif text-2xl text-cedar-300">
                    {category.name.charAt(0)}
                  </div>
                )}
              </div>
              <span className="p-3 text-center text-sm font-medium text-ink-900">{category.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {onSale.length > 0 && (
        <section className="mx-auto max-w-[1800px] px-4 py-16 sm:px-6 lg:px-10">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="font-serif text-2xl font-semibold text-ink-900">On Sale</h2>
            <Link href="/shop?onSale=1" className="text-sm font-medium text-cedar-600 hover:underline">
              View all
            </Link>
          </div>
          <ProductGrid products={onSale.slice(0, 8)} />
        </section>
      )}

      {bestSellers.length > 0 && (
        <section className="mx-auto max-w-[1800px] px-4 py-16 sm:px-6 lg:px-10">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="font-serif text-2xl font-semibold text-ink-900">Best Sellers</h2>
            <Link href="/shop" className="text-sm font-medium text-cedar-600 hover:underline">
              View all
            </Link>
          </div>
          <ProductGrid products={bestSellers} />
        </section>
      )}

      <section className="mx-auto max-w-[1800px] px-4 py-16 sm:px-6 lg:px-10">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="font-serif text-2xl font-semibold text-ink-900">New Arrivals</h2>
          <Link href="/shop" className="text-sm font-medium text-cedar-600 hover:underline">
            View all
          </Link>
        </div>
        <ProductGrid products={newArrivals} />
      </section>
    </div>
  );
}
