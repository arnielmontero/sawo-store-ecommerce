import type { OrderStatus } from "./api";

// Mirrors apps/api/src/lib/orderStateMachine.ts — the server is the real
// source of truth (it rejects anything not listed here), this just decides
// which action buttons/menu items to show.
export const NEXT_STATES: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PAID", "CANCELLED"],
  PAID: ["SHIPPED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "RETURNED", "REFUNDED"],
  // "It arrived and the customer wants a refund" is the most common
  // real-world return case — delivery doesn't close off refunding.
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
  RETURNED: [],
  // Only reachable when the store has partial refunds on — the order page
  // hides this action entirely otherwise, since REFUNDED-from-PARTIALLY
  // requires opening the refund panel, same as REFUNDED-from-PAID/SHIPPED.
  PARTIALLY_REFUNDED: ["REFUNDED"],
};

export const ACTION_LABELS: Record<OrderStatus, string> = {
  PENDING: "Mark Pending",
  PAID: "Mark Paid",
  SHIPPED: "Mark Shipped",
  DELIVERED: "Mark Delivered",
  CANCELLED: "Cancel Order",
  REFUNDED: "Refund",
  RETURNED: "Mark Returned",
  PARTIALLY_REFUNDED: "Refund",
};

// Past-tense phrasing for a completed event in an order's timeline — distinct
// from ACTION_LABELS, which is imperative button text ("Cancel Order") and
// reads wrong as a history entry.
export const STATUS_HISTORY_LABELS: Record<OrderStatus, string> = {
  PENDING: "Order placed",
  PAID: "Payment received",
  SHIPPED: "Order shipped",
  DELIVERED: "Order delivered",
  CANCELLED: "Order cancelled",
  REFUNDED: "Order refunded",
  RETURNED: "Order returned",
  PARTIALLY_REFUNDED: "Order partially refunded",
};

// The order lifecycle's happy path, in order — used to render the Timeline
// as a fixed roadmap (so "Order delivered" always has a slot even before it
// happens) instead of a variable-length list that only shows whatever
// statusHistory rows exist so far.
export const HAPPY_PATH_STATUSES: OrderStatus[] = ["PENDING", "PAID", "SHIPPED", "DELIVERED"];
