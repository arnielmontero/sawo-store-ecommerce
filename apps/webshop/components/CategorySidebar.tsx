"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Category } from "@/lib/api";

function countProducts(category: Category): number {
  return category._count.products + category.children.reduce((sum, c) => sum + countProducts(c), 0);
}

function CategoryGroup({ category, activeSlug }: { category: Category; activeSlug?: string }) {
  const hasChildren = category.children.length > 0;
  const isActiveParent = category.children.some((c) => c.slug === activeSlug);
  const [open, setOpen] = useState(isActiveParent || category.slug === activeSlug);
  const total = countProducts(category);

  if (total === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <Link
          href={`/category/${category.slug}`}
          className={`flex-1 py-1.5 text-sm font-medium transition-colors hover:text-cedar-600 ${
            activeSlug === category.slug ? "text-cedar-600" : "text-ink-900"
          }`}
        >
          {category.name}
          <span className="ml-1.5 text-xs font-normal text-ink-300">({total})</span>
        </Link>
        {hasChildren && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Collapse" : "Expand"}
            className="px-2 py-1.5 text-ink-500 hover:text-cedar-600"
          >
            <span className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>›</span>
          </button>
        )}
      </div>
      {hasChildren && open && (
        <div className="ml-3 flex flex-col border-l border-ink-100 pl-3">
          {category.children.map((child) => (
            <Link
              key={child.id}
              href={`/category/${child.slug}`}
              className={`py-1.5 text-sm transition-colors hover:text-cedar-600 ${
                activeSlug === child.slug ? "font-medium text-cedar-600" : "text-ink-700"
              }`}
            >
              {child.name}
              <span className="ml-1.5 text-xs text-ink-300">({child._count.products})</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function CategorySidebar({ categories }: { categories: Category[] }) {
  const pathname = usePathname();
  const activeSlug = pathname?.startsWith("/category/") ? pathname.split("/")[2] : undefined;

  return (
    <nav aria-label="Categories" className="flex flex-col gap-1 rounded-2xl bg-white p-5 shadow-card">
      <h2 className="mb-2 font-serif text-lg font-semibold text-ink-900">Categories</h2>
      <Link
        href="/shop"
        className={`py-1.5 text-sm font-medium transition-colors hover:text-cedar-600 ${
          !activeSlug && pathname === "/shop" ? "text-cedar-600" : "text-ink-900"
        }`}
      >
        All Products
      </Link>
      {categories.map((category) => (
        <CategoryGroup key={category.id} category={category} activeSlug={activeSlug} />
      ))}
    </nav>
  );
}
