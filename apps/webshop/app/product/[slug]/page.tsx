import { notFound } from "next/navigation";
import { fetchAllProducts, fetchCategoryTree, fetchProduct } from "@/lib/api";
import { ProductDetailView } from "@/components/ProductDetailView";
import { ProductGrid } from "@/components/ProductGrid";
import type { Crumb } from "@/components/Breadcrumbs";

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const [product, categories] = await Promise.all([fetchProduct(params.slug), fetchCategoryTree()]);
  if (!product) notFound();

  const crumbs: Crumb[] = [];
  if (product.category) {
    const parent = categories.find((c) => c.children.some((child) => child.slug === product.category!.slug));
    if (parent) crumbs.push({ label: parent.name, href: `/category/${parent.slug}` });
    crumbs.push({ label: product.category.name, href: `/category/${product.category.slug}` });
  }
  crumbs.push({ label: product.title });

  const related = product.category
    ? (await fetchAllProducts({ category: product.category.slug }))
        .filter((p) => p.slug !== product.slug)
        .slice(0, 4)
    : [];

  return (
    <>
      <ProductDetailView product={product} breadcrumbs={crumbs} />
      {related.length > 0 && (
        <section className="mx-auto max-w-[1280px] px-4 pb-16 sm:px-6 lg:px-10">
          <h2 className="mb-6 font-serif text-2xl font-semibold text-ink-900">You May Also Like</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </>
  );
}
