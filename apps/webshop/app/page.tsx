import Image from "next/image";
import Link from "next/link";
import { fetchCategoryTree, fetchProducts } from "@/lib/api";
import { ProductGrid } from "@/components/ProductGrid";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default async function HomePage() {
  const [{ products: bestSellers }, { products: newArrivals }, categories] = await Promise.all([
    fetchProducts({ sortBy: "createdAt", sortDir: "desc" }).then((page) => ({
      products: page.products.filter((p) => p.isBestSeller).slice(0, 4),
    })),
    fetchProducts({ sortBy: "createdAt", sortDir: "desc" }).then((page) => ({
      products: page.products.slice(0, 8),
    })),
    fetchCategoryTree(),
  ]);

  return (
    <div>
      <section className="relative overflow-hidden bg-ink-900">
        <Image
          src={`${API_URL}/uploads/seed/hero-sauna-interior.webp`}
          alt="A warm cedar sauna interior"
          fill
          priority
          className="object-cover opacity-60"
        />
        <div className="relative mx-auto flex min-h-[70vh] max-w-7xl flex-col justify-center px-4 py-24 sm:px-6 lg:px-8">
          <span className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-cedar-200">
            Nordic Sauna Essentials
          </span>
          <h1 className="max-w-xl font-serif text-5xl font-semibold leading-tight text-white sm:text-6xl">
            Build your ritual, one warm evening at a time.
          </h1>
          <p className="mt-5 max-w-md text-lg text-cream-100/90">
            Heaters, stones, benches, and accessories chosen for real Nordic sauna comfort.
          </p>
          <Link
            href="/shop"
            className="mt-8 w-fit rounded-full bg-cedar-500 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-cedar-600"
          >
            Shop All Products
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="mb-8 font-serif text-2xl font-semibold text-ink-900">Shop by Category</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/category/${category.slug}`}
              className="flex flex-col items-center gap-3 rounded-2xl bg-white p-5 text-center shadow-card transition-shadow hover:shadow-cardHover"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-cedar-100 font-serif text-xl text-cedar-700">
                {category.name.charAt(0)}
              </span>
              <span className="text-sm font-medium text-ink-900">{category.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {bestSellers.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="font-serif text-2xl font-semibold text-ink-900">Best Sellers</h2>
            <Link href="/shop" className="text-sm font-medium text-cedar-600 hover:underline">
              View all
            </Link>
          </div>
          <ProductGrid products={bestSellers} />
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
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
