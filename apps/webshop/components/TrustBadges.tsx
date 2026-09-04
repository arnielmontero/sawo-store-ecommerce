// Every claim here maps to something actually true of this store today —
// no fabricated "10M+ customers" style marketplace stats. Genuine SAWO
// product sourcing, the real order-tracking flow (see /track), and a
// direct-to-brand support line are the honest equivalents of Shopee's
// trust-badge row for a single-brand storefront.
const BADGES = [
  { icon: "✓", label: "Authentic SAWO Products", description: "Sourced directly from SAWO" },
  { icon: "📦", label: "Order Tracking", description: "Track any order by reference" },
  { icon: "🔒", label: "Secure Checkout", description: "Your info stays protected" },
  { icon: "💬", label: "Real Support", description: "Our team reviews every order" },
] as const;

export function TrustBadges() {
  return (
    <section className="border-y border-ink-100 bg-white">
      <div className="mx-auto grid max-w-[1800px] grid-cols-2 gap-6 px-4 py-8 sm:grid-cols-4 sm:px-6 lg:px-10">
        {BADGES.map((badge) => (
          <div key={badge.label} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cedar-50 text-lg text-cedar-700"
            >
              {badge.icon}
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">{badge.label}</p>
              <p className="text-xs text-ink-500">{badge.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
