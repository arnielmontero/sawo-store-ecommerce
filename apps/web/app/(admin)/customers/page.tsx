"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchCustomers, type Customer } from "@/lib/api";
import { formatCents } from "@/lib/format";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [hasCartItems, setHasCartItems] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchCustomers(page, search || undefined, hasCartItems || undefined)
      .then((result) => {
        setCustomers(result.customers);
        setPagination(result.pagination);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load customers."))
      .finally(() => setLoading(false));
  }, [page, search, hasCartItems]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink-900">Customers</h1>
      </div>

      <div className="mt-6 rounded-xl border border-ink-100 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
          <p className="text-sm font-medium text-ink-900">Customers ({pagination.total})</p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={hasCartItems}
                onChange={(e) => {
                  setHasCartItems(e.target.checked);
                  setPage(1);
                }}
                className="h-4 w-4"
              />
              Has cart items
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by email or name..."
              className="rounded-md border border-ink-100 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        {error ? (
          <p className="px-5 py-8 text-center text-sm text-brand-600">{error}</p>
        ) : loading ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">Loading...</p>
        ) : customers.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">
            {search || hasCartItems ? "No customers match your filters." : "No customers yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-3 py-3 font-medium">Joined</th>
                  <th className="px-3 py-3 font-medium">Orders</th>
                  <th className="px-3 py-3 font-medium">Total spent</th>
                  <th className="px-3 py-3 font-medium">In cart</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-b border-ink-100 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link href={`/customers/${customer.id}`} className="font-medium text-ink-900 hover:text-brand-600 hover:underline">
                        {customer.name || customer.email}
                      </Link>
                      {customer.name && <p className="text-xs text-ink-400">{customer.email}</p>}
                    </td>
                    <td className="px-3 py-3 text-ink-700">
                      {new Date(customer.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3 text-ink-700">{customer.orderCount}</td>
                    <td className="px-3 py-3 text-ink-700">{formatCents(customer.totalSpentCents)}</td>
                    <td className="px-3 py-3">
                      {customer.cartItemCount > 0 ? (
                        <Link
                          href={`/customers/${customer.id}`}
                          className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                          title="Items logged as cart interest, not yet checked out"
                        >
                          {customer.cartItemCount} item{customer.cartItemCount === 1 ? "" : "s"}
                        </Link>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-ink-100 px-5 py-4">
            <p className="text-xs text-ink-500">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} customers)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
