import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-ink-100 bg-white">
      <div className="mx-auto grid max-w-[1800px] grid-cols-1 gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6 lg:px-10">
        <div>
          <span className="font-serif text-xl font-semibold text-ink-900">
            SAWO<span className="text-cedar-600">.</span>
          </span>
          <p className="mt-3 text-sm text-ink-500">
            Heaters, stones, benches, and accessories for a proper Nordic sauna experience.
          </p>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-ink-900">Shop</h4>
          <ul className="flex flex-col gap-2 text-sm text-ink-500">
            <li><Link href="/shop" className="hover:text-cedar-600">All Products</Link></li>
            <li><Link href="/search" className="hover:text-cedar-600">Search</Link></li>
            <li><Link href="/cart" className="hover:text-cedar-600">Cart</Link></li>
            <li><Link href="/track" className="hover:text-cedar-600">Track Order</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-ink-900">More from SAWO</h4>
          <ul className="flex flex-col gap-2 text-sm text-ink-500">
            <li><a href="https://www.sawo.com/contact/" className="hover:text-cedar-600">Contact Us</a></li>
            <li><a href="https://www.sawo.com/frequently-asked-questions/" className="hover:text-cedar-600">FAQ</a></li>
            <li><a href="https://www.sawo.com/about-us/" className="hover:text-cedar-600">About Us</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-100 py-5 text-center text-xs text-ink-300">
        © {new Date().getFullYear()} SAWO. All rights reserved.
      </div>
    </footer>
  );
}
