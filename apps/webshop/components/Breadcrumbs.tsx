import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-ink-500">
      <Link href="/" className="hover:text-cedar-600">
        Home
      </Link>
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1.5">
          <span className="text-ink-300">/</span>
          {item.href ? (
            <Link href={item.href} className="hover:text-cedar-600">
              {item.label}
            </Link>
          ) : (
            <span className="text-ink-900" aria-current="page">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
