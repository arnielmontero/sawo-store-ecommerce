# Sawo Store — E-Commerce Backend + Admin Panel

A TypeScript monorepo: an Express/Prisma/MySQL API implementing the core backend
of an e-commerce system, and a Next.js admin panel for managing orders.

**Scope note:** the frontend built here is an **admin backoffice only** — there
is no customer-facing storefront. The API includes storefront-shaped endpoints
(product browsing, checkout, order history) because the backend was built to
the full spec, but nothing in `apps/web` renders them to a shopper.

## Stack

| | |
|---|---|
| API | Express, TypeScript, Prisma |
| Database | **MySQL** (not PostgreSQL) |
| Admin UI | Next.js (App Router), Tailwind |
| Payments | Stripe (test mode) |
| Auth | JWT access tokens + HttpOnly refresh cookies |
| Local infra | Podman Compose (MySQL + Adminer) |

## Running it

```bash
npm install
npm run dev          # starts MySQL via Podman, then the API (:4000) and web app (:3000)
npm run db:seed      # admin/staff accounts, sample customers, one product, sample orders
```

Admin panel: http://localhost:3000/login — `admin` / `admin123` (full access) or
`staff` / `staff123` (Fulfillment Staff — same order access, no user management yet).

## What's built

### 1. Schema & data models

MySQL via Prisma. Two separate identity tables by design, not an oversight:

- **`AdminUser`** — backoffice login (`ADMIN`, `FULFILLMENT_STAFF`). Username +
  password.
- **`User`** — customer accounts (`CUSTOMER` role only so far). Exists to
  support the `Order.userId` relation; there's no registration flow or
  customer-facing login.

Catalog: `Category` → `Product` → `ProductVariant` (SKU, price, JSON
`attributes` for size/color/etc.) → `Inventory` (one row per variant,
`stockQuantity` + `reservedQuantity` tracked separately for the reservation
pattern below).

Orders: `Order` → `OrderItem` → `ProductVariant`. See §4 for the status enum
and pricing fields.

### 2. Auth & roles (JWT + RBAC)

Admin-only — there is no customer auth system (see §3/§4 for where that gap
shows up).

- **Access token**: real JWT (`jsonwebtoken`), 15 min TTL, carries `userId` +
  `role`. Sent as `Authorization: Bearer <token>`.
- **Refresh token**: opaque random value, 7-day TTL, stored **hashed** in
  `AdminRefreshToken` (MySQL — the original spec suggested Redis; we don't run
  Redis, so this is a table instead). Delivered as an `HttpOnly`,
  `SameSite=Strict` cookie. **Rotates on every use** — the old token is
  revoked and a new one issued, so a stolen refresh token only works once.
- **RBAC**: `requireRole(...)` is rank-based (`EDITOR`-equivalent <
  `ADMIN` < ... ), not exact-match, so higher roles automatically satisfy
  lower-role checks.
- The access token is kept **in memory only** on the frontend (never
  `localStorage`) — an XSS bug can't exfiltrate a long-lived credential. A
  page reload silently calls `/api/auth/refresh` using the cookie to
  re-establish the session.

Endpoints: `POST /api/auth/login`, `POST /api/auth/refresh`,
`POST /api/auth/logout`, `GET /api/auth/me`.

### 3. Products & inventory

| Endpoint | Access | Notes |
|---|---|---|
| `GET /api/v1/products` | Public | Paginated, filter by category/price |
| `GET /api/v1/products/:slug` | Public | Includes live `availableStock` per variant |
| `POST /api/v1/products` | Admin | Creates product + variants + initial inventory |
| `POST /api/v1/inventory/reserve` | **Unauthenticated** | See gap below |

**Atomic stock reservation** — the core anti-oversell mechanism, implemented
as a single conditional `UPDATE`:

```sql
UPDATE Inventory
SET reservedQuantity = reservedQuantity + ?
WHERE variantId = ? AND (stockQuantity - reservedQuantity) >= ?
```

The affected-row count tells the caller whether the reservation succeeded.
MySQL's row lock during the `UPDATE` prevents two concurrent requests from
both reading "1 available" and both succeeding. **Verified under real
concurrency**: 10 simultaneous requests against 1 unit of stock → exactly 1
succeeded, 9 correctly rejected.

No Redis-backed high-throughput path was built (the spec offered it as an
optional path for flash-sale scale; the MySQL approach was the recommended
baseline and is what we run).

### 4. Order processing & state machine

Strict, unidirectional transitions (`lib/orderStateMachine.ts`):

```
PENDING → PAID → SHIPPED → DELIVERED
   ↓        ↓        ↓
CANCELLED REFUNDED RETURNED
```

`DELIVERED`, `CANCELLED`, `REFUNDED`, `RETURNED` are terminal. Every
transition is checked against this table server-side — invalid transitions
return `409`, regardless of caller.

Each transition carries a matching inventory side-effect: `PAID` converts a
reservation into a real deduction; `CANCELLED` releases the reservation;
`REFUNDED`/`RETURNED` restock already-deducted units.

**Pricing pipeline** — the server never trusts a client-submitted total; it
re-derives everything from current variant prices at checkout time.
Discount/shipping/tax are **stubbed at 0**, not implemented — there's no
discount-code table, shipping-rate source, or tax API account. The pipeline's
shape (`subtotal - discount + shipping + tax = total`) is correct and each
piece can be filled in independently later.

| Endpoint | Access | Notes |
|---|---|---|
| `POST /api/orders/checkout` | **Unauthenticated** | See gap below |
| `GET /api/orders/me?userId=` | **Unauthenticated**, `userId` as a query param | See gap below |
| `GET /api/orders` | Admin/Staff | All orders (admin list view) |
| `GET /api/orders/:id` | Admin/Staff | Single order |
| `PATCH /api/orders/:id/status` | Admin/Staff | State-machine-checked transition |

### 5. Payments (Stripe)

| Endpoint | Access | Notes |
|---|---|---|
| `POST /api/v1/payments/intent` | **Unauthenticated** | Creates a Stripe PaymentIntent, idempotent |
| `POST /api/v1/payments/webhook` | Stripe signature | `payment_intent.succeeded`/`.payment_failed` |
| `POST /api/v1/payments/refund` | Admin | Full refund only |

- **Idempotency**: `Order.paymentAttemptCount` increments per `/intent` call;
  `${orderId}-${attemptCount}` is passed as Stripe's own idempotency key, so a
  network retry reuses the original PaymentIntent instead of double-charging.
- **Webhook replay protection**: `ProcessedWebhookEvent` (MySQL, same
  Redis-substitution as refresh tokens) records each Stripe `event.id`;
  duplicates are acknowledged but not reprocessed. The event is marked
  processed only *after* its side-effect succeeds, so a failure lets Stripe's
  automatic retry actually fix it instead of being silently swallowed.
- **Refund is full-amount only.** Partial refunds would need an `amount`
  field and matching partial-inventory-restock logic — not built.
- Verified end-to-end with locally-signed test webhook payloads (no real
  Stripe account needed for that part). `/intent` and `/refund` need real
  Stripe test-mode keys in `.env` to actually reach Stripe's API.

## Known gaps

**No customer authentication system.** This is the single biggest gap, and it
cascades into every endpoint marked "Customer" in the original spec:

- `POST /inventory/reserve`, `POST /orders/checkout`, `POST /payments/intent`
  are all **unauthenticated**, rate-limited as the only current safeguard.
- `GET /orders/me` takes `userId` as a plain query parameter — anyone can pass
  any ID. Explicitly a stand-in, not a real access control.

None of this matters for the admin panel itself (which *is* fully
authenticated), but none of these endpoints are safe to expose to real
customers as-is.

**Admin UI is Orders-only.** The sidebar links to Dashboard, Catalog,
Customers, Shipping, Payments, and Configuration — only Dashboard (a stub)
and Orders have real pages. The Product/Inventory and Payments APIs above
have no admin UI wired to them yet.

**Discount codes, real shipping rates, and tax calculation** are stubbed at
zero — no supporting tables or third-party integrations (TaxJar/AvaTax, a
carrier rate API) exist.

**Partial refunds** are not implemented — refund is all-or-nothing.

## Local development notes

- `compose.yml` runs MySQL (port `33061`, to avoid colliding with other local
  MySQL instances) and Adminer (`:8080`) for browsing the database.
- `npm run dev` from the repo root starts everything with one command.
- Fresh-schema pushes use `prisma db push --force-reset` rather than
  migrations — this is a from-scratch dev rebuild, not a production
  deployment with data to preserve.
