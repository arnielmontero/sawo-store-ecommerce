"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/context/CartContext";

export function Header() {
  const { itemCount, openCart } = useCart();
  const router = useRouter();
  const [search, setSearch] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) router.push(`/search?q=${encodeURIComponent(search.trim())}`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-cream-50/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="font-serif text-2xl font-semibold tracking-tight text-ink-900">
          SAWO<span className="text-cedar-600">.</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-ink-700 md:flex">
          <Link href="/" className="hover:text-cedar-600">Home</Link>
          <Link href="/shop" className="hover:text-cedar-600">Shop</Link>
        </nav>

        <form onSubmit={handleSearch} className="ml-auto hidden max-w-xs flex-1 items-center sm:flex">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sauna products…"
            className="w-full rounded-full border border-ink-100 bg-white px-4 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-cedar-400 focus:outline-none"
          />
        </form>

        <div className="ml-auto flex items-center gap-4 sm:ml-0">
          <button
            type="button"
            onClick={openCart}
            className="relative flex items-center gap-1 rounded-full bg-cedar-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-cedar-700"
          >
            Cart
            {itemCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-cedar-700">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
