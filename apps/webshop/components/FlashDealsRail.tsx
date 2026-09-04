import type { Product } from "@/lib/api";
import Link from "next/link";
import { ProductCard } from "./ProductCard";
import { CountdownTimer } from "./CountdownTimer";

// Shows a single shared countdown for the whole rail, keyed to the soonest
// real saleEndsAt among the deals shown — not one timer per card, since
// most on-sale products here won't have an admin-set end date at all (see
// CountdownTimer's comment: never fabricate one). No real deadline among
// the deals shown just means no countdown renders, only the deals rail.
export function FlashDealsRail({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  const soonestEndsAt = products
    .map((p) => p.saleEndsAt)
    .filter((d): d is string => !!d)
    .sort()[0];

  return (
    <section className="bg-ink-900 py-10">
      <div className="mx-auto max-w-[1800px] px-4 sm:px-6 lg:px-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-serif text-2xl font-semibold text-white">⚡ Flash Deals</h2>
            {soonestEndsAt && <CountdownTimer endsAt={soonestEndsAt} />}
          </div>
          <Link href="/shop?onSale=1" className="text-sm font-medium text-cedar-300 hover:text-cedar-200">
            View all deals →
          </Link>
        </div>

        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
          {products.map((product) => (
            <div key={product.id} className="w-[46vw] shrink-0 sm:w-[220px]">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
