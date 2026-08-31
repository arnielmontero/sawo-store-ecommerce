"use client";

import { useEffect, useState } from "react";
import { fetchPayments, refundPayment, type Payment } from "@/lib/api";
import { formatCents, formatPaymentMethod } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/lib/auth-context";

export default function PaymentsPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchPayments()
      .then(setPayments)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load payments."))
      .finally(() => setLoading(false));
  }, []);

  async function handleRefund(orderId: number) {
    setActionError(null);
    setRefundingId(orderId);
    try {
      const updated = await refundPayment(orderId);
      setPayments((prev) => prev.map((p) => (p.id === orderId ? { ...p, status: updated.status } : p)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to refund order.");
    } finally {
      setRefundingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink-900">Payments</h1>
      </div>
      <p className="mt-1 text-sm text-ink-500">Orders that have gone through payment processing.</p>

      {actionError && (
        <p className="mt-4 rounded-md bg-brand-50 px-4 py-2 text-sm text-brand-600">{actionError}</p>
      )}

      <div className="mt-6 rounded-xl border border-ink-100 bg-white">
        <div className="border-b border-ink-100 px-5 py-4">
          <p className="text-sm font-medium text-ink-900">Transactions ({payments.length})</p>
        </div>

        {error ? (
          <p className="px-5 py-8 text-center text-sm text-brand-600">{error}</p>
        ) : loading ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">Loading...</p>
        ) : payments.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">No payments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-3 font-medium">Reference</th>
                  <th className="px-3 py-3 font-medium">Payment ID</th>
                  <th className="px-3 py-3 font-medium">Method</th>
                  <th className="px-3 py-3 font-medium">Amount</th>
                  <th className="px-3 py-3 font-medium">Attempts</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-ink-100 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-ink-900">{payment.reference}</td>
                    <td className="px-3 py-3 font-mono text-xs text-ink-500">
                      {payment.stripePaymentIntentId ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-ink-700">{formatPaymentMethod(payment.paymentMethod)}</td>
                    <td className="px-3 py-3 text-ink-700">
                      {formatCents(payment.totalCents, payment.currency)}
                    </td>
                    <td className="px-3 py-3 text-ink-700">{payment.paymentAttemptCount}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={payment.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      {payment.status === "PAID" && user?.role === "ADMIN" && (
                        <button
                          onClick={() => handleRefund(payment.id)}
                          disabled={refundingId === payment.id}
                          className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          {refundingId === payment.id ? "Refunding..." : "Refund"}
                        </button>
                      )}
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
