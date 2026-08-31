"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchCustomers, type Customer } from "@/lib/api";
import { formatCents } from "@/lib/format";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers()
      .then((page) => setCustomers(page.customers))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load customers."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink-900">Customers</h1>
      </div>

      <div className="mt-6 rounded-xl border border-ink-100 bg-white">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <p className="text-sm font-medium text-ink-900">Customers ({customers.length})</p>
          <input
            type="text"
            placeholder="Search..."
            className="rounded-md border border-ink-100 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {error ? (
          <p className="px-5 py-8 text-center text-sm text-brand-600">{error}</p>
        ) : loading ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">Loading...</p>
        ) : customers.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">No customers yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-3 py-3 font-medium">Joined</th>
                  <th className="px-3 py-3 font-medium">Orders</th>
                  <th className="px-3 py-3 font-medium">Total spent</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-b border-ink-100 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-ink-900">
                      <Link href={`/customers/${customer.id}`} className="hover:text-brand-600 hover:underline">
                        {customer.email}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-700">
                      {new Date(customer.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3 text-ink-700">{customer.orderCount}</td>
                    <td className="px-3 py-3 text-ink-700">{formatCents(customer.totalSpentCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
