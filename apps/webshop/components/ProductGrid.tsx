import type { Product } from "@/lib/api";
import { ProductCard } from "./ProductCard";

export function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-ink-100 text-ink-500">
        No products match these filters.
      </div>
    );
  }

  // Density matters more than card size on a storefront — a 3-up grid on a
  // wide desktop blows each product image up to ~500px and makes the page
  // read like a template demo. Stepping up to 4/5 columns on larger screens
  // keeps images at a realistic catalog scale and puts more of the catalog
  // above the fold, the way an actual retail grid behaves.
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 xl:grid-cols-4 2xl:grid-cols-5">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
