// Single source of truth for "how long is too long" at each fulfillment
// stage — imported by both notification.service.ts (inbox alerts) and
// shipping.service.ts (inline Deliveries overdue badges) so the two can
// never silently disagree about what counts as overdue.
export const PENDING_STALE_HOURS = 24;
export const PAID_STALE_HOURS = 48;
export const SHIPPED_STALE_DAYS = 7;
