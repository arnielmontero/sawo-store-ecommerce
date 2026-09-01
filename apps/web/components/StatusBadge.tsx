import type { OrderStatus } from "@/lib/api";

const STYLES: Record<OrderStatus, string> = {
  PENDING: "bg-brand-50 text-brand-600",
  PAID: "bg-emerald-50 text-emerald-700",
  SHIPPED: "bg-blue-50 text-blue-700",
  DELIVERED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-gray-100 text-ink-500",
  REFUNDED: "bg-gray-100 text-ink-500",
  RETURNED: "bg-amber-50 text-amber-700",
  PARTIALLY_REFUNDED: "bg-amber-50 text-amber-700",
};

const LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  RETURNED: "Returned",
  PARTIALLY_REFUNDED: "Partially Refunded",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
