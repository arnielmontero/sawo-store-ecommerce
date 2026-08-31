# Backend status — what's done, what the frontend still needs to build

This tracks backend endpoints that exist and are seeded with data, versus
what admin UI pages / client-side views still need to be built against them.
Update this file whenever a backend piece or a frontend piece changes state.

## Already has an admin UI page

| Page | Route | Backend it calls |
|---|---|---|
| Orders | `/orders` (list) + `/orders/:id` (detail) | `GET /api/orders`, `GET /api/orders/:id`, `PATCH /api/orders/:id/status` |
| Catalog | `/catalog` (list) + `/catalog/:id` (detail/edit) + `/catalog/new` | `GET/POST /api/v1/products`, `GET/PATCH/DELETE /api/v1/products/admin/:id`, plus everything in the Catalog section below |
| Customers | `/customers` (list) + `/customers/:id` (detail) | `GET /api/v1/customers`, `GET /api/v1/customers/:id` |
| Deliveries | `/deliveries` | `GET /api/v1/shipping/pending`, `PATCH /api/v1/shipping/:orderId/ship` |
| Payments | `/payments` | `GET /api/v1/payments`, `POST /api/v1/payments/refund` |

Orders list has a working search box (filters by reference/customer email/status,
client-side), a real "Order Statistics" slide-over panel (total orders, revenue,
avg order value, new clients, per-status breakdown — computed from the same
order list, no extra backend call), and a per-row ••• menu with "View order"
plus context-aware status-transition actions (e.g. "Mark Paid" on a PENDING
row), gated to ADMIN/FULFILLMENT_STAFF. Clicking a reference opens the detail
page: customer, payment method, tracking number, full itemized line items
(product/SKU/attributes/qty/price), subtotal/total breakdown, shipping
address, and the same transition action buttons. The dead "Help" / "New
Customer" / "Export table" buttons and non-functional checkboxes/pagination
from the original mockup have been removed rather than left as fake UI.

Customers list links to a detail view (order history, total spent). Deliveries
shows the PAID/awaiting-fulfillment queue with an inline tracking-number
input and "Mark shipped" button per row (calls the ship endpoint, row drops
out of the queue on success). Payments shows every order that reached
payment processing, with a "Refund" button shown only for PAID orders and
only to ADMIN-role users (FULFILLMENT_STAFF can view but not refund, matching
the API's `requireRole(AdminRole.ADMIN)` on that route).

**Known limitation, not a bug:** the Refund button correctly calls
`POST /api/v1/payments/refund`, but that route calls the real
`stripe.refunds.create` — since `STRIPE_SECRET_KEY` in `.env` is still the
placeholder (`sk_test_placeholder`), any real refund attempt gets a 500 from
Stripe, which the UI surfaces as an "Internal server error" banner instead of
silently failing. This is expected until a real Stripe test key is added.
Mark-shipped has no such dependency and works end-to-end today (verified via
Playwright: order left the pending queue and showed SHIPPED elsewhere).

## Catalog — full feature set (built to match standard e-commerce admin parity)

Schema additions: `ProductImage` (gallery), `Tag`/`ProductTag` (many-to-many),
`Product.compareAtPriceCents`/`metaTitle`/`metaDescription`/`sortOrder`,
`ProductVariant.imageUrl` (per-variant override image).

| Feature | Route(s) | Notes |
|---|---|---|
| CRUD + soft delete | `GET/PATCH/DELETE /api/v1/products/admin/:id` | Delete = `isActive: false`, never a real DB delete (order history safety) |
| Multi-image gallery | `POST/DELETE /api/v1/products/admin/:id/images`, `PATCH .../feature`, `PATCH .../reorder` | Drag-to-reorder in the UI; first upload auto-becomes featured; deleting the featured image auto-promotes the next one |
| Real file upload | `POST /api/v1/products/admin/:id/images`, `POST /api/v1/uploads` | **Local disk storage** (`apps/api/uploads/`, gitignored), served back at `GET /uploads/:filename`. Random UUID filenames — never trusts the client's filename. 5MB cap, JPEG/PNG/WEBP/GIF only. Not S3 — fine for local dev, would need real cloud storage before a multi-server production deploy. |
| Variant option matrix | `POST /api/v1/products/admin/:id/variants/generate` | Define option sets (e.g. Size: S,M,L × Color: Black,White) and every combination is created as a new variant in one call; skips combinations that already exist |
| Sale / compare-at price | `basePriceCents` + `compareAtPriceCents` on Product | Catalog list shows the sale price in red with the compare-at price struck through when set |
| SEO fields | `metaTitle` (70 char), `metaDescription` (320 char) | Editable in a collapsible "SEO fields" section on the product detail page |
| Tags | `Tag`/`ProductTag`, `GET /api/v1/products/admin/tags` | Free-form, created on the fly (no separate "manage tags" screen needed) — type a tag name and press Enter |
| Bulk actions | `POST /api/v1/products/admin/bulk/{activate,deactivate,category,price}` | Multi-select checkboxes in the Catalog list surface a bulk-action bar (activate/deactivate/set category/adjust price by %) |
| CSV import/export | `GET /api/v1/products/admin/export`, `POST .../import` | One row per variant (standard convention). Import upserts by Handle (slug) for products and SKU for variants, so re-importing an exported file is a safe no-op; creates categories/tags on the fly; malformed rows are collected into an `errors` list and skipped rather than aborting the whole import |
| Variant-level image | `ProductVariant.imageUrl` | Optional per-variant override (e.g. red variant shows a red photo), editable inline in the variant table; falls back to the product's featured image when unset |
| Search / category filter | Catalog list page, client-side + `?category=` | Unchanged from before this pass |

**Explicitly out of scope for this pass** (by user decision): a stock-change
audit log (who/when/old-value/new-value per adjustment) was considered and
deliberately deferred — stock edits via `PATCH .../variants/:id/stock` still
work, they're just not logged anywhere beyond the current value.

## Backend exists, but not meant for an admin page

These are the "Customer"-facing endpoints from the original spec — they exist
and work, but there's no customer-facing app in this project, so nothing
should render them in the admin UI:

- `POST /api/v1/inventory/reserve`
- `POST /api/orders/checkout`
- `GET /api/orders/me?userId=`
- `POST /api/v1/payments/intent`
- `POST /api/v1/payments/webhook` (Stripe calls this directly, never a browser)

**Known gap carried by all of these:** there is no customer authentication
system. They're unauthenticated (rate-limited only) as a placeholder. Do not
wire a customer-facing UI to them without adding real customer auth first —
right now `GET /orders/me` trusts a plain `userId` query param, which is not
a real access control.

## No backend yet

- **Configuration** — sidebar link exists, no defined scope, no backend,
  no page. Skipped deliberately (see conversation — no concrete requirement
  for what it should configure).
- **Dashboard** — has a page, but it's an empty stub (just shows the logged-in
  user's name). No summary stats, charts, or real content wired up.

## Seed data reference

`npm run db:seed` (from `apps/api`) now seeds enough to exercise every
endpoint above:

- 6 products / 15 variants / 3 categories (`apps/api/prisma/seed.ts`) —
  3 products carry seed tags (`bestseller`, `everyday`, `summer`, `new`) and
  one ("Graphic Tee — Wave") has a seeded `compareAtPriceCents` so the sale
  price + tags UI has real data without any manual setup
- 12 customers — customer1 has 3 orders, customer3 has 2, the rest have 1
  (for testing the Customers list's order-count/spend columns with real variety)
- 15 orders spanning all 7 statuses (PENDING, PAID, SHIPPED, DELIVERED,
  CANCELLED, REFUNDED, RETURNED — every status the state machine and
  StatusBadge support now has at least one real example). Spread across the
  last ~30 days (`daysAgo` per order) instead of all landing on the seed
  run's timestamp, so the Order Statistics panel and date columns show a
  believable trend instead of one spike. Most have a shipping address; the
  ones at SHIPPED/DELIVERED/RETURNED also have a fake tracking number. 12 of
  15 have a fake `stripePaymentIntentId` (visible in the Payments list).
- Login: `admin` / `admin123` (ADMIN), `staff` / `staff123` (FULFILLMENT_STAFF)

Re-run `npm run db:seed` after any `prisma db push --force-reset` to restore
this data. Note: clicking "Mark shipped", a status-transition action, or
"Refund" in the CMS mutates this seed data for real (it's the same dev
database) — re-seed if you want the original 15-order baseline back.
