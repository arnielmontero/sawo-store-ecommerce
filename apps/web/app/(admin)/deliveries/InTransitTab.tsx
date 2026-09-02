"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchShipments, exportShipmentsCsvUrl, type Shipment, type ShipmentSortField, type SortDir } from "@/lib/api";
import { DeliveryProgress } from "@/components/DeliveryProgress";
import { ShipmentFilterBar } from "./ShipmentFilterBar";
import { OverdueBadge } from "./OverdueBadge";

const SORTABLE_COLUMNS: { field: ShipmentSortField; label: string }[] = [
  { field: "createdAt", label: "Ordered" },
  { field: "updatedAt", label: "Last update" },
];

export function InTransitTab() {
  const [orders, setOrders] = useState<Shipment[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [carrierFilter, setCarrierFilter] = useState<string[]>([]);
  const [countryFilter, setCountryFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<ShipmentSortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  function load() {
    setLoading(true);
    fetchShipments("in-transit", {
      search: search || undefined,
      carrier: carrierFilter.length > 0 ? carrierFilter : undefined,
      country: countryFilter.length > 0 ? countryFilter : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      sortBy,
      sortDir,
      page,
    })
      .then((result) => {
        setOrders(result.shipments);
        setPagination(result.pagination);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load shipment status."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [search, carrierFilter, countryFilter, dateFrom, dateTo, sortBy, sortDir, page]);

  const hasFilters = carrierFilter.length > 0 || countryFilter.length > 0 || Boolean(dateFrom) || Boolean(dateTo);

  function clearFilters() {
    setCarrierFilter([]);
    setCountryFilter([]);
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  function handleSort(field: ShipmentSortField) {
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
    setPage(1);
  }

  function sortIndicator(field: ShipmentSortField) {
    if (sortBy !== field) return null;
    return <span className="ml-1 text-ink-400">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  async function handleExport() {
    const url = await exportShipmentsCsvUrl("in-transit", {
      search: search || undefined,
      carrier: carrierFilter.length > 0 ? carrierFilter : undefined,
      country: countryFilter.length > 0 ? countryFilter : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
    const a = document.createElement("a");
    a.href = url;
    a.download = "deliveries-in-transit-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-4 rounded-xl border border-ink-100 bg-white">
      <div className="flex items-center justify-between gap-3 px-5 pt-4">
        <p className="text-sm font-medium text-ink-900">In transit ({pagination.total})</p>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-md border border-ink-100 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh status"}
        </button>
      </div>

      <ShipmentFilterBar
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        carrier={carrierFilter}
        onCarrierChange={(next) => {
          setCarrierFilter(next);
          setPage(1);
        }}
        country={countryFilter}
        onCountryChange={(next) => {
          setCountryFilter(next);
          setPage(1);
        }}
        dateFrom={dateFrom}
        onDateFromChange={(value) => {
          setDateFrom(value);
          setPage(1);
        }}
        dateTo={dateTo}
        onDateToChange={(value) => {
          setDateTo(value);
          setPage(1);
        }}
        hasFilters={hasFilters}
        onClearFilters={clearFilters}
        onExport={handleExport}
      />

      {error ? (
        <p className="px-5 py-8 text-center text-sm text-brand-600">{error}</p>
      ) : loading ? (
        <p className="px-5 py-8 text-center text-sm text-ink-500">Loading...</p>
      ) : orders.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-500">
          {search || hasFilters
            ? "No in-transit shipments match your search or filters."
            : "Nothing in transit. Orders appear here once marked shipped."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                <th className="px-5 py-3 font-medium">Reference</th>
                <th className="px-3 py-3 font-medium">Carrier</th>
                <th className="px-3 py-3 font-medium">Tracking number</th>
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
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-ink-100 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-ink-900">
                    <Link
                      href={`/orders/${order.id}?readonly=1`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-brand-600 hover:underline"
                      title="Open order for review in a new tab"
                    >
                      {order.reference}
                    </Link>
                    <OverdueBadge reason={order.overdueReason} paidAt={order.paidAt} updatedAt={order.updatedAt} />
                  </td>
                  <td className="px-3 py-3 text-ink-700">{order.carrier ?? "—"}</td>
                  <td className="px-3 py-3 font-mono text-xs text-ink-700">{order.trackingNumber ?? "—"}</td>
                  <td className="px-3 py-3 text-ink-700">{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-3 text-ink-700">{new Date(order.updatedAt).toLocaleDateString()}</td>
                  <td className="px-3 py-3">
                    <DeliveryProgress status={order.deliveryStatus} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    {order.easypostTrackingUrl && (
                      <a
                        href={order.easypostTrackingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-brand-600 hover:underline"
                      >
                        View tracking
                      </a>
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
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} shipments)
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
  );
}
