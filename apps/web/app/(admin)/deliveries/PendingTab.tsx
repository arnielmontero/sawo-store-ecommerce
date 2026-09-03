"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchShipments,
  exportShipmentsCsvUrl,
  shipOrder,
  fetchLabelPreview,
  fetchLabelQuote,
  buyShipEngineLabel,
  type Shipment,
  type ShipmentSortField,
  type SortDir,
  type LabelPreview,
  type LabelQuote,
} from "@/lib/api";
import { formatCents } from "@/lib/format";
import { CARRIER_OPTIONS } from "@/lib/constants";
import { useStoreSettings } from "@/lib/store-settings-context";
import { ShipmentFilterBar } from "./ShipmentFilterBar";
import { OverdueBadge } from "./OverdueBadge";

const SORTABLE_COLUMNS: { field: ShipmentSortField; label: string }[] = [
  { field: "paidAt", label: "Paid" },
  { field: "totalCents", label: "Total" },
];

type BulkResult = "pending" | "shipping" | "done" | { error: string };

export function PendingTab() {
  const { settings } = useStoreSettings();
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

  // "Buy label" review panel (ShipStation only) — replaces manual tracking-
  // number entry with a real ShipEngine label purchase. Only one row's
  // panel is open at a time.
  const [labelPanelOrderId, setLabelPanelOrderId] = useState<number | null>(null);
  const [labelPreview, setLabelPreview] = useState<LabelPreview | null>(null);
  const [labelPreviewLoading, setLabelPreviewLoading] = useState(false);
  const [labelCarrier, setLabelCarrier] = useState("");
  const [labelStreet1, setLabelStreet1] = useState("");
  const [labelStreet2, setLabelStreet2] = useState("");
  const [labelCity, setLabelCity] = useState("");
  const [labelState, setLabelState] = useState("");
  const [labelPostalCode, setLabelPostalCode] = useState("");
  const [buyingLabelId, setBuyingLabelId] = useState<number | null>(null);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [labelQuote, setLabelQuote] = useState<LabelQuote | null>(null);
  const [labelQuoteLoading, setLabelQuoteLoading] = useState(false);
  const [labelQuoteError, setLabelQuoteError] = useState<string | null>(null);

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
    a.download = "deliveries-pending-export.xlsx";
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

  async function openLabelPanel(orderId: number) {
    setLabelError(null);
    setLabelPanelOrderId(orderId);
    setLabelPreview(null);
    setLabelPreviewLoading(true);
    try {
      const preview = await fetchLabelPreview(orderId);
      setLabelPreview(preview);
      setLabelCarrier(preview.carrier && preview.availableCarriers.includes(preview.carrier) ? preview.carrier : preview.availableCarriers[0] ?? "");
      setLabelStreet1(preview.street1);
      setLabelStreet2(preview.street2 ?? "");
      setLabelCity(preview.city);
      setLabelState(preview.state);
      setLabelPostalCode(preview.postalCode);
    } catch (err) {
      setLabelError(err instanceof Error ? err.message : "Failed to load address preview.");
    } finally {
      setLabelPreviewLoading(false);
    }
  }

  function closeLabelPanel() {
    setLabelPanelOrderId(null);
    setLabelPreview(null);
    setLabelError(null);
    setLabelQuote(null);
    setLabelQuoteError(null);
  }

  // Re-quotes whenever the reviewed carrier or address changes — debounced
  // so typing in an address field doesn't fire a request per keystroke.
  // This is what makes "Confirm purchase" show a real, current price
  // instead of confirming blind; quotes cost nothing and have no side
  // effects (see fetchLabelQuote), so re-fetching freely here is safe.
  useEffect(() => {
    // Invalidated immediately (not just on the debounce firing) so
    // "Confirm purchase" can never stay enabled showing a price that no
    // longer matches the currently-typed fields, even during the 500ms
    // debounce window.
    setLabelQuote(null);
    if (!labelPanelOrderId || !labelCarrier || !labelStreet1.trim() || !labelCity.trim() || !labelState.trim() || !labelPostalCode.trim()) {
      return;
    }
    const orderId = labelPanelOrderId;
    const timer = setTimeout(() => {
      setLabelQuoteError(null);
      setLabelQuoteLoading(true);
      fetchLabelQuote(orderId, {
        carrier: labelCarrier,
        address: {
          street1: labelStreet1.trim(),
          street2: labelStreet2.trim() || undefined,
          city: labelCity.trim(),
          state: labelState.trim(),
          postalCode: labelPostalCode.trim(),
        },
      })
        .then(setLabelQuote)
        .catch((err) => {
          setLabelQuote(null);
          setLabelQuoteError(err instanceof Error ? err.message : "Failed to get a price quote.");
        })
        .finally(() => setLabelQuoteLoading(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [labelPanelOrderId, labelCarrier, labelStreet1, labelStreet2, labelCity, labelState, labelPostalCode]);

  async function handleBuyLabel(orderId: number) {
    if (!labelStreet1.trim() || !labelCity.trim() || !labelState.trim() || !labelPostalCode.trim()) {
      setLabelError("Street, City, State, and Zip are all required before buying a label.");
      return;
    }
    setLabelError(null);
    setBuyingLabelId(orderId);
    try {
      await buyShipEngineLabel(orderId, {
        carrier: labelCarrier || undefined,
        address: {
          street1: labelStreet1.trim(),
          street2: labelStreet2.trim() || undefined,
          city: labelCity.trim(),
          state: labelState.trim(),
          postalCode: labelPostalCode.trim(),
        },
      });
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      setPagination((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
      closeLabelPanel();
    } catch (err) {
      setLabelError(err instanceof Error ? err.message : "Failed to buy label.");
    } finally {
      setBuyingLabelId(null);
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

  // ShipStation orders are bought one at a time with mandatory address
  // review (see openLabelPanel/handleBuyLabel) — incompatible with an
  // unattended bulk loop, since each purchase costs real money. Bulk
  // selection/shipping stays EasyPost-only.
  const isShipStation = settings?.deliveryProvider === "SHIPSTATION";

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
                {!isShipStation && (
                  <th className="w-10 px-5 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === orders.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4"
                    />
                  </th>
                )}
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
                const selectedCarrier = carrierInputs[order.id] ?? CARRIER_OPTIONS[0];

                // ShipStation only tracks carriers actually connected on the
                // ShipEngine account (see store-settings-context.tsx /
                // settings.service.ts's live GET /v1/carriers lookup) — the
                // dropdown is narrowed to just those instead of offering
                // every CARRIER_OPTIONS value and warning after the fact.
                // The order's auto-assigned carrier (from CarrierRule) can
                // still be one that isn't connected — e.g. this DE order
                // defaulting to DHL when only USPS/UPS are connected — so
                // it's kept in the list as a disabled option rather than
                // silently swapped out from under the admin, making clear
                // why it can't be picked as-is.
                const connectedCarriers = settings?.shipEngineSupportedCarriers ?? [];
                const carrierChoices = isShipStation
                  ? CARRIER_OPTIONS.filter((c) => connectedCarriers.includes(c) || c === order.carrier)
                  : CARRIER_OPTIONS;
                const carrierUntrackable = isShipStation && !connectedCarriers.includes(selectedCarrier);
                const panelOpen = labelPanelOrderId === order.id;
                return (
                  <Fragment key={order.id}>
                  <tr className="border-b border-ink-100 last:border-0 hover:bg-gray-50">
                    {!isShipStation && (
                      <td className="px-5 py-3">
                        <input type="checkbox" checked={selectedIds.has(order.id)} onChange={() => toggleSelect(order.id)} className="h-4 w-4" />
                      </td>
                    )}
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
                        value={selectedCarrier}
                        onChange={(e) => setCarrierInputs((prev) => ({ ...prev, [order.id]: e.target.value }))}
                        className="rounded-md border border-ink-100 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      >
                        {carrierChoices.map((c) => (
                          <option key={c} value={c} disabled={isShipStation && !connectedCarriers.includes(c)}>
                            {c}
                            {isShipStation && !connectedCarriers.includes(c) ? " (not connected)" : ""}
                          </option>
                        ))}
                      </select>
                      {carrierUntrackable && (
                        <p className="mt-1 max-w-[10rem] text-xs text-amber-600">
                          Won&apos;t auto-track under ShipStation.
                        </p>
                      )}
                    </td>
                    {isShipStation ? (
                      <>
                        <td className="px-3 py-3 text-ink-500">
                          {order.labelUrl ? (
                            <div>
                              <p className="font-mono text-xs text-ink-900">{order.trackingNumber}</p>
                              <a
                                href={order.labelUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-brand-600 hover:underline"
                              >
                                View label
                              </a>
                            </div>
                          ) : (
                            <span className="text-xs text-ink-400">No label yet</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {!order.labelUrl && (
                            <button
                              onClick={() => (panelOpen ? closeLabelPanel() : openLabelPanel(order.id))}
                              className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                            >
                              {panelOpen ? "Cancel" : "Buy label"}
                            </button>
                          )}
                        </td>
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
                  </tr>
                  {isShipStation && panelOpen && (
                    <tr className="border-b border-ink-100 bg-gray-50">
                      <td colSpan={8} className="px-5 py-4">
                        {labelPreviewLoading ? (
                          <p className="text-sm text-ink-500">Loading address preview...</p>
                        ) : (
                          <div className="max-w-2xl space-y-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                              Review before buying — {order.reference}
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-ink-500">Carrier</label>
                                <select
                                  value={labelCarrier}
                                  onChange={(e) => setLabelCarrier(e.target.value)}
                                  className="mt-1 w-full rounded-md border border-ink-100 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                                >
                                  {(labelPreview?.availableCarriers ?? []).map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs text-ink-500">Street 2 (optional)</label>
                                <input
                                  type="text"
                                  value={labelStreet2}
                                  onChange={(e) => setLabelStreet2(e.target.value)}
                                  className="mt-1 w-full rounded-md border border-ink-100 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                                />
                              </div>
                              <div className="col-span-2">
                                <label className="block text-xs text-ink-500">Street 1</label>
                                <input
                                  type="text"
                                  value={labelStreet1}
                                  onChange={(e) => setLabelStreet1(e.target.value)}
                                  className="mt-1 w-full rounded-md border border-ink-100 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-ink-500">City</label>
                                <input
                                  type="text"
                                  value={labelCity}
                                  onChange={(e) => setLabelCity(e.target.value)}
                                  className="mt-1 w-full rounded-md border border-ink-100 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-ink-500">State</label>
                                <input
                                  type="text"
                                  value={labelState}
                                  onChange={(e) => setLabelState(e.target.value)}
                                  className="mt-1 w-full rounded-md border border-ink-100 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-ink-500">Zip</label>
                                <input
                                  type="text"
                                  value={labelPostalCode}
                                  onChange={(e) => setLabelPostalCode(e.target.value)}
                                  className="mt-1 w-full rounded-md border border-ink-100 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                                />
                              </div>
                            </div>
                            {(!labelPreview?.street1 || !labelPreview?.city) && (
                              <p className="text-xs text-amber-600">
                                Couldn&apos;t fully auto-parse this order&apos;s address — please check the fields above
                                before buying.
                              </p>
                            )}

                            <div className="rounded-md border border-ink-100 bg-white px-3 py-2">
                              {labelQuoteLoading ? (
                                <p className="text-sm text-ink-500">Getting a price quote...</p>
                              ) : labelQuoteError ? (
                                <p className="text-sm text-brand-600">{labelQuoteError}</p>
                              ) : labelQuote ? (
                                <div className="flex items-baseline justify-between">
                                  <span className="text-sm text-ink-700">{labelQuote.serviceName}</span>
                                  <span className="text-sm font-semibold text-ink-900">
                                    {formatCents(labelQuote.amountCents, labelQuote.currency)}
                                    {labelQuote.deliveryDays != null && (
                                      <span className="ml-2 text-xs font-normal text-ink-500">
                                        ~{labelQuote.deliveryDays}d delivery
                                      </span>
                                    )}
                                  </span>
                                </div>
                              ) : (
                                <p className="text-sm text-ink-400">Fill in the address to see a price.</p>
                              )}
                            </div>

                            {labelError && <p className="text-sm text-brand-600">{labelError}</p>}
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleBuyLabel(order.id)}
                                disabled={buyingLabelId === order.id || !labelQuote || labelQuoteLoading}
                                className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                              >
                                {buyingLabelId === order.id
                                  ? "Buying..."
                                  : labelQuote
                                  ? `Confirm purchase — ${formatCents(labelQuote.amountCents, labelQuote.currency)}`
                                  : "Confirm purchase"}
                              </button>
                              <button
                                onClick={closeLabelPanel}
                                className="rounded-md border border-ink-100 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-white"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
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
