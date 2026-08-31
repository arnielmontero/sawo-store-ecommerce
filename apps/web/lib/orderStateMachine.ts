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
