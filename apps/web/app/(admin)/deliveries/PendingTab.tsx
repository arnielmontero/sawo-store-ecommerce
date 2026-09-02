"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchShipments,
  exportShipmentsCsvUrl,
  shipOrder,
  type Shipment,
  type ShipmentSortField,
  type SortDir,
} from "@/lib/api";
import { formatCents } from "@/lib/format";
import { CARRIER_OPTIONS } from "@/lib/constants";
import { ShipmentFilterBar } from "./ShipmentFilterBar";
import { OverdueBadge } from "./OverdueBadge";

const SORTABLE_COLUMNS: { field: ShipmentSortField; label: string }[] = [
  { field: "paidAt", label: "Paid" },
  { field: "totalCents", label: "Total" },
];

type BulkResult = "pending" | "shipping" | "done" | { error: string };

export function PendingTab() {
  const [orders, setOrders] = useState<Shipment[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [carrierFilter, setCarrierFilter] = useState<string[]>([]);
  const [countryFilter, setCountryFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<ShipmentSortField>("paidAt");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [trackingInputs, setTrackingInputs] = useState<Record<number, string>>({});
  const [carrierInputs, setCarrierInputs] = useState<Record<number, string>>({});
  const [shippingId, setShippingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkShipping, setBulkShipping] = useState(false);
  const [bulkResults, setBulkResults] = useState<Record<number, BulkResult>>({});
  const [bulkSummary, setBulkSummary] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  function load() {
    setLoading(true);
    fetchShipments("pending", {
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
        setCarrierInputs((prev) => {
          const next = { ...prev };
          for (const o of result.shipments) {
            if (!(o.id in next)) next[o.id] = o.carrier ?? CARRIER_OPTIONS[0];
          }
          return next;
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load deliveries."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [search, carrierFilter, countryFilter, dateFrom, dateTo, sortBy, sortDir, page]);

  // Selection is scoped to the current page/filter view — switching page
  // or changing filters clears it, since a row selected but no longer
  // visible would be a confusing state to carry forward.
  useEffect(() => {
    setSelectedIds(new Set());
    setBulkResults({});
    setBulkSummary(null);
  }, [orders]);

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
      setSortDir("asc");
    }
    setPage(1);
  }

  function sortIndicator(field: ShipmentSortField) {
    if (sortBy !== field) return null;
    return <span className="ml-1 text-ink-400">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  async function handleExport() {
    const url = await exportShipmentsCsvUrl("pending", {
      search: search || undefined,
      carrier: carrierFilter.length > 0 ? carrierFilter : undefined,
      country: countryFilter.length > 0 ? countryFilter : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
    const a = document.createElement("a");
    a.href = url;
    a.download = "deliveries-pending-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleShip(orderId: number) {
    const trackingNumber = trackingInputs[orderId]?.trim();
    if (!trackingNumber) {
      setActionError("Enter a tracking number before marking as shipped.");
      return;
    }
    setActionError(null);
    setShippingId(orderId);
    try {
      await shipOrder(orderId, trackingNumber, carrierInputs[orderId]);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      setPagination((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to mark order as shipped.");
    } finally {
      setShippingId(null);
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.size === orders.length ? new Set() : new Set(orders.map((o) => o.id))));
  }

  // Sequential, not Promise.all — each ship call hits EasyPost independently
  // with no natural cross-order transaction, so one row failing must never
  // block or roll back the others. Rows are removed from the list as they
  // succeed (visible progress), failures stay in place with their tracking
  // input still editable for a retry.
  async function handleBulkShip() {
    setBulkShipping(true);
    setBulkSummary(null);
    const ids = Array.from(selectedIds);
    let succeeded = 0;
    let failed = 0;

    for (const id of ids) {
      const trackingNumber = trackingInputs[id]?.trim();
      if (!trackingNumber) {
        setBulkResults((prev) => ({ ...prev, [id]: { error: "Enter a tracking number first" } }));
        failed++;
        continue;
      }
      setBulkResults((prev) => ({ ...prev, [id]: "shipping" }));
      try {
        await shipOrder(id, trackingNumber, carrierInputs[id]);
        setBulkResults((prev) => ({ ...prev, [id]: "done" }));
        setOrders((prev) => prev.filter((o) => o.id !== id));
        setPagination((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
        succeeded++;
      } catch (err) {
        setBulkResults((prev) => ({ ...prev, [id]: { error: err instanceof Error ? err.message : "Failed to ship" } }));
        failed++;
      }
    }

    setBulkSummary(
      failed === 0
        ? `${succeeded} of ${ids.length} order(s) shipped.`
        : `${succeeded} of ${ids.length} order(s) shipped. ${failed} failed — see below.`
    );
    setSelectedIds(new Set());
    setBulkShipping(false);
  }

  return (
    <div className="mt-4 rounded-xl border border-ink-100 bg-white">
      <div className="flex items-center justify-between gap-3 px-5 pt-4">
        <p className="text-sm font-medium text-ink-900">Pending delivery ({pagination.total})</p>
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

      {(actionError || bulkSummary) && (
        <div className="px-5 py-3">
          {actionError && <p className="rounded-md bg-brand-50 px-4 py-2 text-sm text-brand-600">{actionError}</p>}
          {bulkSummary && <p className="mt-2 rounded-md bg-gray-50 px-4 py-2 text-sm text-ink-700">{bulkSummary}</p>}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between border-b border-ink-100 bg-brand-50 px-5 py-2.5">
          <p className="text-sm font-medium text-brand-600">{selectedIds.size} selected</p>
          <button
            onClick={handleBulkShip}
            disabled={bulkShipping}
            className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {bulkShipping ? "Shipping..." : `Ship selected (${selectedIds.size})`}
          </button>
        </div>
      )}

      {error ? (
        <p className="px-5 py-8 text-center text-sm text-brand-600">{error}</p>
      ) : loading ? (
        <p className="px-5 py-8 text-center text-sm text-ink-500">Loading...</p>
      ) : orders.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-500">
          {search || hasFilters ? "No pending deliveries match your search or filters." : "Nothing awaiting delivery."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                <th className="w-10 px-5 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === orders.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4"
                  />
                </th>
                <th className="px-3 py-3 font-medium">Reference</th>
                <th className="px-3 py-3 font-medium">Items</th>
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
                <th className="px-3 py-3 font-medium">Country</th>
                <th className="px-3 py-3 font-medium">Carrier</th>
                <th className="px-3 py-3 font-medium">Tracking number</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const result = bulkResults[order.id];
                return (
                  <tr key={order.id} className="border-b border-ink-100 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <input type="checkbox" checked={selectedIds.has(order.id)} onChange={() => toggleSelect(order.id)} className="h-4 w-4" />
                    </td>
                    <td className="px-3 py-3 font-medium text-ink-900">
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
                    <td className="px-3 py-3 text-ink-700">{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                    <td className="px-3 py-3 text-ink-700">{formatCents(order.totalCents, order.currency)}</td>
                    <td className="px-3 py-3 text-ink-700">{order.paidAt ? new Date(order.paidAt).toLocaleDateString() : "—"}</td>
                    <td className="px-3 py-3 text-ink-700">{order.shippingCountry ?? "—"}</td>
                    <td className="px-3 py-3">
                      <select
                        value={carrierInputs[order.id] ?? CARRIER_OPTIONS[0]}
                        onChange={(e) => setCarrierInputs((prev) => ({ ...prev, [order.id]: e.target.value }))}
                        className="rounded-md border border-ink-100 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      >
                        {CARRIER_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        placeholder="e.g. 1Z999AA10123456784"
                        value={trackingInputs[order.id] ?? ""}
                        onChange={(e) => setTrackingInputs((prev) => ({ ...prev, [order.id]: e.target.value }))}
                        className="w-48 rounded-md border border-ink-100 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      />
                      {result && typeof result === "object" && (
                        <p className="mt-1 text-xs text-brand-600">{result.error}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleShip(order.id)}
                        disabled={shippingId === order.id || result === "shipping"}
                        className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                      >
                        {shippingId === order.id || result === "shipping" ? "Shipping..." : "Mark shipped"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-ink-100 px-5 py-4">
          <p className="text-xs text-ink-500">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} orders)
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
