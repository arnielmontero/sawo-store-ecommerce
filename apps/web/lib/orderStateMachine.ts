import type { OrderStatus } from "./api";

// Mirrors apps/api/src/lib/orderStateMachine.ts — the server is the real
// source of truth (it rejects anything not listed here), this just decides
// which action buttons/menu items to show.
export const NEXT_STATES: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PAID", "CANCELLED"],
  PAID: ["SHIPPED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
  RETURNED: [],
};

export const ACTION_LABELS: Record<OrderStatus, string> = {
  PENDING: "Mark Pending",
  PAID: "Mark Paid",
  SHIPPED: "Mark Shipped",
  DELIVERED: "Mark Delivered",
  CANCELLED: "Cancel Order",
  REFUNDED: "Refund",
  RETURNED: "Mark Returned",
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
};
