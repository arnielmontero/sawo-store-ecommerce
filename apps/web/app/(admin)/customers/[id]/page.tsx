"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchCustomer, type CustomerDetail } from "@/lib/api";
import { formatCents, formatPaymentMethod } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomer(Number(params.id))
      .then(setCustomer)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load customer."))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <p className="text-sm text-ink-500">Loading...</p>;
  if (error) return <p className="text-sm text-brand-600">{error}</p>;
  if (!customer) return null;

  const completed = customer.orders.filter((o) => ["PAID", "SHIPPED", "DELIVERED"].includes(o.status));
  const totalSpentCents = completed.reduce((sum, o) => sum + o.totalCents, 0);

  return (
    <div>
      <Link href="/customers" className="text-sm text-ink-500 hover:text-brand-600">
        ← Back to Customers
      </Link>

      <div className="mt-3 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink-900">{customer.email}</h1>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-ink-100 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-ink-500">Joined</p>
          <p className="mt-1 text-lg font-semibold text-ink-900">
            {new Date(customer.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="rounded-xl border border-ink-100 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-ink-500">Orders</p>
          <p className="mt-1 text-lg font-semibold text-ink-900">{customer.orders.length}</p>
        </div>
        <div className="rounded-xl border border-ink-100 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-ink-500">Total spent</p>
          <p className="mt-1 text-lg font-semibold text-ink-900">{formatCents(totalSpentCents)}</p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-ink-100 bg-white">
        <div className="border-b border-ink-100 px-5 py-4">
          <p className="text-sm font-medium text-ink-900">Order history</p>
        </div>

        {customer.orders.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-3 font-medium">Reference</th>
                  <th className="px-3 py-3 font-medium">Items</th>
                  <th className="px-3 py-3 font-medium">Price</th>
                  <th className="px-3 py-3 font-medium">Payment</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {customer.orders.map((order) => (
                  <tr key={order.id} className="border-b border-ink-100 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-ink-900">{order.reference}</td>
                    <td className="px-3 py-3 text-ink-700">
                      {order.items.reduce((sum, item) => sum + item.quantity, 0)}
                    </td>
                    <td className="px-3 py-3 text-ink-700">
                      {formatCents(order.totalCents, order.currency)}
                    </td>
                    <td className="px-3 py-3 text-ink-700">{formatPaymentMethod(order.paymentMethod)}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-3 py-3 text-ink-700">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
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
