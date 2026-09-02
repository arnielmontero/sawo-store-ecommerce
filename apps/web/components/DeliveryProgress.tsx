// EasyPost's own status vocabulary, in delivery order — used to render the
// progress steps. "unknown"/"error"/"failure"/"cancelled"/"return_to_sender"
// aren't part of the normal happy path, so they're shown as a plain label
// instead of a step position.
const STATUS_STEPS = ["pre_transit", "in_transit", "out_for_delivery", "delivered"] as const;

export function statusLabel(status: string | null) {
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

export function DeliveryProgress({ status }: { status: string | null }) {
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
