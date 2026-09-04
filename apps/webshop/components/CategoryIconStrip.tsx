import Image from "next/image";
import Link from "next/link";

export interface CategoryPreview {
  category: { id: number; name: string; slug: string };
  image: string | null;
}

// Shopee-style compact category row — circular thumbnails instead of large
// tiles, so more categories fit above the fold. Uses each category's real
// representative product photo (same source as the larger category tiles
// elsewhere) rather than illustrated icons, since we have no icon asset
// pipeline and won't substitute generic clipart for real catalog data.
export function CategoryIconStrip({ categories }: { categories: CategoryPreview[] }) {
  if (categories.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1800px] px-4 py-8 sm:px-6 lg:px-10">
      <div className="grid grid-cols-4 gap-y-6 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
        {categories.map(({ category, image }) => (
          <Link
            key={category.id}
            href={`/category/${category.slug}`}
            className="group flex flex-col items-center gap-2 px-1 text-center"
          >
            <div className="relative h-16 w-16 overflow-hidden rounded-full border border-ink-100 bg-cream-100 transition-colors group-hover:border-cedar-400 sm:h-20 sm:w-20">
              {image ? (
                <Image
                  src={image}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-contain p-3 transition-transform duration-300 group-hover:scale-110"
                />
              ) : (
                <div className="flex h-full items-center justify-center font-serif text-lg text-cedar-300">
                  {category.name.charAt(0)}
                </div>
              )}
            </div>
            <span className="line-clamp-2 text-xs font-medium text-ink-700 group-hover:text-cedar-600">
              {category.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
