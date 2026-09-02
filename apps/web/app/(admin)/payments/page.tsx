"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchPayments,
  exportPaymentsCsvUrl,
  refundPayment,
  type Payment,
  type PaymentSortField,
  type SortDir,
  type PaymentMethod,
  type OrderStatus,
} from "@/lib/api";
import { formatCents, formatPaymentMethod } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";
import { useAuth } from "@/lib/auth-context";

const SORTABLE_COLUMNS: { field: PaymentSortField; label: string }[] = [
  { field: "createdAt", label: "Date" },
  { field: "totalCents", label: "Amount" },
  { field: "paymentAttemptCount", label: "Attempts" },
];

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "CARD", label: "Card" },
  { value: "BANK", label: "Bank" },
  { value: "PAYPAL", label: "PayPal" },
  { value: "PAY_WITH_CHECK", label: "Pay with Check" },
];

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "PAID", label: "Paid" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REFUNDED", label: "Refunded" },
  { value: "PARTIALLY_REFUNDED", label: "Partially Refunded" },
  { value: "RETURNED", label: "Returned" },
];

export default function PaymentsPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<PaymentMethod[]>([]);
  const [statusFilter, setStatusFilter] = useState<OrderStatus[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<PaymentSortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Debounce the search box so every keystroke doesn't fire a request.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  function load() {
    setLoading(true);
    fetchPayments({
      search: search || undefined,
      paymentMethod: methodFilter.length > 0 ? methodFilter : undefined,
      status: statusFilter.length > 0 ? statusFilter : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      sortBy,
      sortDir,
      page,
    })
      .then((result) => {
        setPayments(result.payments);
        setPagination(result.pagination);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load payments."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [search, methodFilter, statusFilter, dateFrom, dateTo, sortBy, sortDir, page]);

  const hasFilters = methodFilter.length > 0 || statusFilter.length > 0 || Boolean(dateFrom) || Boolean(dateTo);

  function clearFilters() {
    setMethodFilter([]);
    setStatusFilter([]);
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  async function handleExport() {
    const url = await exportPaymentsCsvUrl({
      search: search || undefined,
      paymentMethod: methodFilter.length > 0 ? methodFilter : undefined,
      status: statusFilter.length > 0 ? statusFilter : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
    const a = document.createElement("a");
    a.href = url;
    a.download = "payments-export.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSort(field: PaymentSortField) {
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
    setPage(1);
  }

  function sortIndicator(field: PaymentSortField) {
    if (sortBy !== field) return null;
    return <span className="ml-1 text-ink-400">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

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
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
          <p className="text-sm font-medium text-ink-900">Transactions ({pagination.total})</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by reference, payment ID, or customer email..."
              className="w-80 rounded-md border border-ink-100 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
            />
            <button
              onClick={handleExport}
              className="shrink-0 rounded-md border border-ink-100 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-gray-50"
            >
              Export XLSX
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-5 py-3">
          <MultiSelectDropdown
            label="All methods"
            options={METHOD_OPTIONS}
            selected={methodFilter}
            onChange={(next) => {
              setMethodFilter(next);
              setPage(1);
            }}
          />
          <MultiSelectDropdown
            label="All statuses"
            options={STATUS_OPTIONS}
            selected={statusFilter}
            onChange={(next) => {
              setStatusFilter(next);
              setPage(1);
            }}
          />
          <div className="flex items-center gap-1.5 text-sm text-ink-500">
            <span>From</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-ink-100 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
            />
            <span>to</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-ink-100 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
            />
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-500 hover:bg-gray-50 hover:text-ink-900"
            >
              Clear filters
            </button>
          )}
        </div>

        {error ? (
          <p className="px-5 py-8 text-center text-sm text-brand-600">{error}</p>
        ) : loading ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">Loading...</p>
        ) : payments.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">
            {search || hasFilters ? "No payments match your search or filters." : "No payments yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-3 font-medium">Reference</th>
                  <th className="px-3 py-3 font-medium">Payment ID</th>
                  <th className="px-3 py-3 font-medium">Method</th>
                  {SORTABLE_COLUMNS.map((col) => (
                    <th
                      key={col.field}
                      onClick={() => handleSort(col.field)}
                      className="cursor-pointer select-none px-3 py-3 font-medium hover:text-ink-700"
                    >
                      {col.label}
                      {sortIndicator(col.field)}
                    </th>
                  ))}
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-ink-100 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-ink-900">
                      <Link
                        href={`/orders/${payment.id}?readonly=1`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-brand-600 hover:underline"
                        title="Open order for review in a new tab"
                      >
                        {payment.reference}
                      </Link>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-ink-500">
                      {payment.stripePaymentIntentId ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-ink-700">{formatPaymentMethod(payment.paymentMethod)}</td>
                    <td className="px-3 py-3 text-ink-700">{new Date(payment.createdAt).toLocaleDateString()}</td>
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

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-ink-100 px-5 py-4">
            <p className="text-xs text-ink-500">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} payments)
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
