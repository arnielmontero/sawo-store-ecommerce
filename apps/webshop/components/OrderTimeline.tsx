// Real backoffice statuses (Order.status / OrderStatusHistory), not a
// generic "processing/shipped/delivered" stand-in — RETURNED, CANCELLED,
// and the refund states are all reachable and need their own visual state.
const STEP_ORDER = ["PENDING", "PAID", "SHIPPED", "DELIVERED"] as const;

const TERMINAL_ALTERNATE = new Set(["CANCELLED", "REFUNDED", "RETURNED", "PARTIALLY_REFUNDED"]);

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Order Placed",
  PAID: "Payment Confirmed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  RETURNED: "Returned",
  PARTIALLY_REFUNDED: "Partially Refunded",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function OrderTimeline({
  status,
  timeline,
}: {
  status: string;
  timeline: { status: string; changedAt: string }[];
}) {
  const timestampFor = (step: string) => timeline.find((entry) => entry.status === step)?.changedAt;
  const currentIndex = STEP_ORDER.indexOf(status as (typeof STEP_ORDER)[number]);
  const isAlternateTerminal = TERMINAL_ALTERNATE.has(status);

  if (isAlternateTerminal) {
    const changedAt = timeline[timeline.length - 1]?.changedAt;
    return (
      <div className="rounded-2xl bg-white p-6 shadow-card">
        <p className="font-semibold text-ink-900">{STATUS_LABEL[status] ?? status}</p>
        {changedAt && <p className="mt-1 text-sm text-ink-500">{formatDateTime(changedAt)}</p>}
      </div>
    );
  }

  return (
    <ol className="rounded-2xl bg-white p-6 shadow-card">
      {STEP_ORDER.map((step, index) => {
        const reached = currentIndex >= index;
        const isLast = index === STEP_ORDER.length - 1;
        const changedAt = timestampFor(step);
        return (
          <li key={step} className={`flex gap-4 ${isLast ? "" : "min-h-[64px]"}`}>
            <div className="flex flex-col items-center self-stretch">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  reached ? "bg-cedar-600 text-white" : "bg-cream-200 text-ink-300"
                }`}
              >
                {reached ? "✓" : index + 1}
              </span>
              {!isLast && (
                <span className={`w-0.5 flex-1 ${currentIndex > index ? "bg-cedar-600" : "bg-cream-200"}`} />
              )}
            </div>
            <div className={isLast ? "pb-0" : "pb-6"}>
              <p className={`pt-1 text-sm font-medium ${reached ? "text-ink-900" : "text-ink-300"}`}>
                {STATUS_LABEL[step]}
              </p>
              {changedAt && <p className="text-xs text-ink-500">{formatDateTime(changedAt)}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
