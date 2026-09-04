// Shared by CartDrawer and the /cart page so quantity behavior can't drift
// between the two surfaces. availableStock is a snapshot from whenever the
// item was added to the cart — it can go stale (another sale, an admin
// stock edit), so this always surfaces that directly rather than silently
// clamping the dropdown as if nothing changed.
export function CartQuantitySelect({
  quantity,
  availableStock,
  onChange,
  className = "",
}: {
  quantity: number;
  availableStock: number;
  onChange: (quantity: number) => void;
  className?: string;
}) {
  if (availableStock <= 0) {
    return <p className="text-xs font-medium text-red-600">No longer in stock</p>;
  }

  // Not capped at an arbitrary 10 — offers up to real stock (bounded at a
  // sane 99 so the dropdown never gets absurd for a huge stock count).
  const maxOption = Math.max(quantity, Math.min(availableStock, 99));
  const lowStock = availableStock < quantity;

  return (
    <div className="flex flex-col gap-1">
      <select
        value={quantity}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Quantity"
        className={`rounded-lg border border-ink-100 bg-white px-2 py-1.5 text-sm ${className}`}
      >
        {Array.from({ length: maxOption }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      {lowStock && (
        <p className="text-xs font-medium text-cedar-600">Only {availableStock} left — update quantity</p>
      )}
    </div>
  );
}
