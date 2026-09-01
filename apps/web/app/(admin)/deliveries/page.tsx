"use client";

import { useEffect, useState } from "react";
import {
  fetchPendingShipments,
  fetchInTransitShipments,
  shipOrder,
  type PendingShipment,
  type InTransitShipment,
} from "@/lib/api";
import { formatCents } from "@/lib/format";

const CARRIER_OPTIONS = ["USPS", "UPS", "FedEx", "DHL"];

// EasyPost's own status vocabulary, in delivery order — used to render the
// progress steps. "unknown"/"error"/"failure"/"cancelled"/"return_to_sender"
// aren't part of the normal happy path, so they're shown as a plain label
// instead of a step position.
const STATUS_STEPS = ["pre_transit", "in_transit", "out_for_delivery", "delivered"] as const;

function statusLabel(status: string | null) {
  if (!status) return "Awaiting tracking update";
  switch (status) {
    case "pre_transit":
      return "Label created";
    case "in_transit":
      return "In transit";
    case "out_for_delivery":
      return "Out for delivery";
    case "delivered":
      return "Delivered";
    case "available_for_pickup":
      return "Available for pickup";
    case "return_to_sender":
      return "Returned to sender";
    case "failure":
      return "Delivery failed";
    case "cancelled":
      return "Cancelled";
    case "unknown":
      return "Unknown";
    default:
      return status;
  }
}

function DeliveryProgress({ status }: { status: string | null }) {
  const stepIndex = status ? STATUS_STEPS.indexOf(status as (typeof STATUS_STEPS)[number]) : -1;

  if (stepIndex === -1) {
    return <span className="text-xs font-medium text-ink-500">{statusLabel(status)}</span>;
  }

  return (
    <div className="flex items-center gap-1">
      {STATUS_STEPS.map((step, i) => (
        <div key={step} className="flex items-center gap-1">
          <div
            title={statusLabel(step)}
            className={`h-2 w-6 rounded-full ${i <= stepIndex ? "bg-brand-500" : "bg-gray-200"}`}
          />
        </div>
      ))}
      <span className="ml-2 text-xs font-medium text-ink-700">{statusLabel(status)}</span>
    </div>
  );
}

export default function DeliveriesPage() {
  const [tab, setTab] = useState<"pending" | "in-transit">("pending");

  const [orders, setOrders] = useState<PendingShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trackingInputs, setTrackingInputs] = useState<Record<number, string>>({});
  const [carrierInputs, setCarrierInputs] = useState<Record<number, string>>({});
  const [shippingId, setShippingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [inTransit, setInTransit] = useState<InTransitShipment[]>([]);
  const [inTransitLoading, setInTransitLoading] = useState(true);
  const [inTransitError, setInTransitError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetchPendingShipments()
      .then((result) => {
        setOrders(result);
        setCarrierInputs(Object.fromEntries(result.map((o) => [o.id, o.carrier ?? CARRIER_OPTIONS[0]])));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load deliveries."))
      .finally(() => setLoading(false));
  }

  function loadInTransit() {
    setInTransitLoading(true);
    fetchInTransitShipments()
      .then(setInTransit)
      .catch((err) => setInTransitError(err instanceof Error ? err.message : "Failed to load shipment status."))
      .finally(() => setInTransitLoading(false));
  }

  useEffect(load, []);
  useEffect(() => {
    if (tab === "in-transit") loadInTransit();
  }, [tab]);

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
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to mark order as shipped.");
    } finally {
      setShippingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink-900">Deliveries</h1>
      </div>
      <p className="mt-1 text-sm text-ink-500">Orders paid and waiting to be shipped, and live status once they're on the way.</p>

      <div className="mt-5 flex gap-1 border-b border-ink-100">
        <button
          onClick={() => setTab("pending")}
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            tab === "pending" ? "border-brand-500 text-brand-600" : "border-transparent text-ink-500 hover:text-ink-700"
          }`}
        >
          Pending delivery ({orders.length})
        </button>
        <button
          onClick={() => setTab("in-transit")}
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            tab === "in-transit" ? "border-brand-500 text-brand-600" : "border-transparent text-ink-500 hover:text-ink-700"
          }`}
        >
          In transit
        </button>
      </div>

      {tab === "pending" ? (
        <>
          {actionError && (
            <p className="mt-4 rounded-md bg-brand-50 px-4 py-2 text-sm text-brand-600">{actionError}</p>
          )}

          <div className="mt-4 rounded-xl border border-ink-100 bg-white">
            {error ? (
              <p className="px-5 py-8 text-center text-sm text-brand-600">{error}</p>
            ) : loading ? (
              <p className="px-5 py-8 text-center text-sm text-ink-500">Loading...</p>
            ) : orders.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-500">Nothing awaiting delivery.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                      <th className="px-5 py-3 font-medium">Reference</th>
                      <th className="px-3 py-3 font-medium">Items</th>
                      <th className="px-3 py-3 font-medium">Total</th>
                      <th className="px-3 py-3 font-medium">Ordered</th>
                      <th className="px-3 py-3 font-medium">Country</th>
                      <th className="px-3 py-3 font-medium">Carrier</th>
                      <th className="px-3 py-3 font-medium">Tracking number</th>
                      <th className="px-5 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-b border-ink-100 last:border-0 hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-ink-900">{order.reference}</td>
                        <td className="px-3 py-3 text-ink-700">
                          {order.items.reduce((sum, item) => sum + item.quantity, 0)}
                        </td>
                        <td className="px-3 py-3 text-ink-700">
                          {formatCents(order.totalCents, order.currency)}
                        </td>
                        <td className="px-3 py-3 text-ink-700">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-3 text-ink-700">{order.shippingCountry ?? "—"}</td>
                        <td className="px-3 py-3">
                          <select
                            value={carrierInputs[order.id] ?? CARRIER_OPTIONS[0]}
                            onChange={(e) =>
                              setCarrierInputs((prev) => ({ ...prev, [order.id]: e.target.value }))
                            }
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
                            onChange={(e) =>
                              setTrackingInputs((prev) => ({ ...prev, [order.id]: e.target.value }))
                            }
                            className="w-48 rounded-md border border-ink-100 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                          />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => handleShip(order.id)}
                            disabled={shippingId === order.id}
                            className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                          >
                            {shippingId === order.id ? "Shipping..." : "Mark shipped"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-ink-100 bg-white">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
            <p className="text-sm font-medium text-ink-900">In transit ({inTransit.length})</p>
            <button
              onClick={loadInTransit}
              disabled={inTransitLoading}
              className="rounded-md border border-ink-100 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {inTransitLoading ? "Refreshing..." : "Refresh status"}
            </button>
          </div>

          {inTransitError ? (
            <p className="px-5 py-8 text-center text-sm text-brand-600">{inTransitError}</p>
          ) : inTransitLoading ? (
            <p className="px-5 py-8 text-center text-sm text-ink-500">Loading...</p>
          ) : inTransit.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-500">
              Nothing in transit. Orders appear here once marked shipped.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                    <th className="px-5 py-3 font-medium">Reference</th>
                    <th className="px-3 py-3 font-medium">Carrier</th>
                    <th className="px-3 py-3 font-medium">Tracking number</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {inTransit.map((order) => (
                    <tr key={order.id} className="border-b border-ink-100 last:border-0 hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-ink-900">{order.reference}</td>
                      <td className="px-3 py-3 text-ink-700">{order.carrier ?? "—"}</td>
                      <td className="px-3 py-3 font-mono text-xs text-ink-700">{order.trackingNumber ?? "—"}</td>
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
        </div>
      )}
    </div>
  );
}
