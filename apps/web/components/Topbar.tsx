"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export function Topbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="flex h-16 items-center justify-between border-b border-ink-100 bg-white px-6">
      {/* Decorative only — not wired to any global search yet (each admin page has its own local search/filter instead). */}
      <div className="relative w-72 max-w-full">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
        <input
          type="text"
          placeholder="Search..."
          className="w-full rounded-md border border-ink-100 bg-gray-50 py-2 pl-9 pr-3 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <div className="flex items-center gap-5">
        {/* Decorative only — no notifications system exists yet. */}
        <button className="text-ink-500 hover:text-ink-900" aria-label="Notifications">
          <BellIcon className="h-5 w-5" />
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-white">
              {user?.name?.slice(0, 1).toUpperCase() ?? "?"}
            </div>
            <span className="font-medium text-ink-900">{user?.name ?? "..."}</span>
            <ChevronIcon className="h-4 w-4 text-ink-300" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-40 rounded-md border border-ink-100 bg-white py-1 shadow-lg">
              <button
                onClick={() => {
                  logout();
                  router.replace("/login");
                }}
                className="block w-full px-4 py-2 text-left text-sm text-ink-700 hover:bg-gray-50"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="9" cy="9" r="6" />
      <path d="m17 17-3.5-3.5" />
    </svg>
  );
}

function BellIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M5 8a5 5 0 0 1 10 0c0 4 1.5 5 1.5 5h-13S5 12 5 8Z" />
      <path d="M8.5 16a1.5 1.5 0 0 0 3 0" />
    </svg>
  );
}

function ChevronIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="m6 8 4 4 4-4" />
    </svg>
  );
}
