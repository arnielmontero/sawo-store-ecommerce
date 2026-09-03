# Admin feature completeness — progress log

Working through e-commerce admin feature gaps identified 2026-09-02, one at a time (plan → implement → seed → verify live → next). User instruction: no static/hardcoded demo data, every feature needs a seeder update so it's testable against realistic data.

## Status — ALL 6 ORIGINAL ITEMS DONE (2026-09-03)

1. **Discounts/Promotions** — ✅ DONE, fully verified live
2. **Reviews admin UI** — ✅ DONE, fully verified live
3. **Staff/Roles management** — ✅ DONE, fully verified live (extended 2026-09-03 with a real third role, see below)
4. **Dashboard/Analytics** — ✅ DONE, fully verified live
5. **Tax at checkout** — ✅ DONE, fully verified live
6. **Invoice/receipt generation** — ✅ DONE, fully verified live (finished 2026-09-03)

Sidebar was also regrouped into collapsible sections (Sales / Catalog / Fulfillment / People) as part of this pass.

**Deferred, not started — separate future task:** a basic accounting/bookkeeping export (orders + refunds + tax collected, formatted for import into QuickBooks/Xero). Discussed with the user 2026-09-02/03; real double-entry bookkeeping is explicitly out of scope (that's what dedicated accounting software is for), but a clean export is a reasonable next ask. Not scheduled yet — revisit when asked.

---

## 2026-09-03 session: closed out feature 6, then fixed a real gap in feature 3

### Feature 6 (Invoice/receipt generation) — finished
Picked up exactly where the prior session left off. Live-verified `GET /api/orders/:id/invoice` for the first time (never done before) and found two real, confirmed bugs in `apps/api/src/lib/invoicePdf.ts`:
- SKU column was only 70px wide — real SKUs like `DOOR-CDR-CLR` wrapped to a second line and visually collided with the next row (fixed row height didn't account for wrapped text).
- No page-break handling at all — nothing checked `y` against the page bottom, so a long order would run text off the page with nothing catching it (unexercised by seed data, which tops out at 7 items per order).

Fixed both: widened/repositioned all table columns to fit real SKU lengths, switched to per-row height computed via `doc.heightOfString()` (so a wrapped product title doesn't collide with the next row either), added `doc.addPage()` checks before both the line-item loop and the totals block, and made the table header repeat on each new page. Also fixed a column-overlap bug in the totals block introduced by the column repositioning (totals label width vs. amount column position). Verified with two live tests: re-generated a real 3-item order's invoice (confirmed the SKU-wrap fix), and wrote a throwaway synthetic-data script (`apps/api/test-invoice-pagebreak.ts`, deleted after use — not part of the committed change) with 35 line items to force a page break, confirming clean page-2 continuation with a repeated header and correctly-positioned totals/footer.

### Feature 3 (Staff/Roles management) — real gap found and fixed
User caught that the original "Staff/Roles management" work only ever built account CRUD against the existing 2-value `AdminRole` enum (`ADMIN`/`FULFILLMENT_STAFF`) — it never actually let anyone create a new role or grant different permissions. That's a fair catch; the earlier memory note had flagged this exact fork ("UI-only vs. granular permissions — bigger schema change") and it got implicitly resolved toward the smaller scope without confirming.

Asked the user how far to take it. Chose the middle option: **add one more fixed role** rather than a full custom-roles/permissions system (which would mean replacing the enum with a real Permission model and reworking 49 route-level checks from scratch — a much bigger, separate feature). Landed on:

- **`MANAGER`**: everything `ADMIN` can do — catalog, inventory, coupons, customers, reviews/Q&A moderation, refunds (including return-request approval, which also moves money), carrier/payment-method rules, product image uploads — **except** Staff accounts, Configuration/API credentials, and Tax rules, which stay `ADMIN`-only.
- Updated all 49 `requireRole(AdminRole....)` call sites across 14 route files in `apps/api/src/routes/` to add `MANAGER` everywhere `ADMIN` currently appears (alone or alongside `FULFILLMENT_STAFF`), except the three exclusion files (`settings.routes.ts`, `staff.routes.ts`, `taxRules.routes.ts`).
- Staff admin UI (`apps/web/app/(admin)/staff/page.tsx`): added Manager to both role `<select>` dropdowns and `ROLE_LABELS`.
- Sidebar (`apps/web/components/Sidebar.tsx`): fixed the account-badge text (was hardcoded "Admin"/"Staff" only, now shows the real role via a proper `ROLE_LABELS` map); hid the Configuration nav link entirely for non-ADMIN users (it was visible-but-would-403 before, a real UX gap).
- Seeder: new `manager` / `manager123` demo account in `seedAdmins()`.

**Real bug caught during verification, not just typechecked:** `apps/api/src/lib/jwt.ts`'s `verifyAccessToken()` had its own separate, hardcoded role allowlist (`role !== AdminRole.ADMIN && role !== AdminRole.FULFILLMENT_STAFF` → reject) that the route-level `requireRole()` grep never would have caught, since it doesn't call that function — it does its own manual check. This silently rejected every `MANAGER` login as 401 Unauthorized even though the token was issued correctly and the route-level role checks were all correct. Found by actually logging in as the seeded manager account and hitting a real endpoint (curl), not by reading the code. Fixed to validate against `Object.values(AdminRole)` instead of a hardcoded pair, so this can't recur the next time a role is added.

Verified live end-to-end: manager login issues a correct `MANAGER`-role token; can list/create coupons (200/201); correctly blocked (403 Forbidden, not 401) from `/staff`, `/tax-rules`, and `/settings`; can list orders and reach the refund endpoint (400 on an intentionally-empty body, confirming the role gate passed and only request validation failed).

### Mid-session infra notes (useful if this recurs)
- The Prisma-client-regeneration DLL-lock issue recurred (same as the 2026-09-02 session) after adding `MANAGER` to the schema enum — `apps/api`'s `tsx watch` process holds `node_modules/.prisma/client/query_engine-windows.dll.node` open, and `npx prisma generate`/`db push` fails with `EPERM` until that process is killed. This time, killing just the `tsx watch src/index.ts` process (found via `Get-CimInstance Win32_Process -Filter "Name = 'node.exe'"` and matching command lines) broke `concurrently`'s process tree instead of triggering an auto-respawn, so `apps/api`'s dev server had to be manually restarted afterward with `npm run dev:api` from the repo root (the same command `concurrently`'s "api" leg runs) — this didn't disturb the still-running `web`/`webshop` legs. Worth remembering: this repo's dev setup is one root `npm run dev` via `concurrently` managing all three apps as a process tree, not three independent servers — killing a leaf process to break a file lock can kill that whole leg of the tree, not just free the lock.
- All three apps (`apps/api`, `apps/web`, `apps/webshop`) typecheck cleanly as of the end of this session.

---

## Quick recap of features 1–5 (unchanged from 2026-09-02, kept for context)

### 1. Discounts/Promotions
`Coupon` model (percentage/fixed/free-shipping, optional date window, optional maxUses, tracked usageCount) wired into `pricing.service.ts` + `order.service.ts` (atomic usage-increment transaction with concurrency guard against overrunning maxUses — a stock-reservation-leak bug was caught and fixed here). Admin CRUD at `/api/v1/coupons` + public `/coupons/validate` preview endpoint. New `/coupons` admin page. Storefront checkout got a promo-code input with live preview (final order submission stays the pre-existing mock — storefront checkout has never called a real order-creation API, that's a separate pre-existing gap not in scope). Seeder: 5 demo coupons covering every type + every rejection path.

### 2. Reviews admin UI
Backend (`Review`/`ProductQuestion` models, full routes) already existed — this was UI-only. New `/reviews` admin page (two tabs: Reviews, Questions) with product-search-driven "log new" forms, purchaser picker (verified-purchase gate), delete/moderate for reviews, answer flow for questions. A separate `ReviewsAndQnaPanel.tsx` component already existed too, but it's a per-product embedded panel (used on product detail pages) — complementary to the new global cross-product `/reviews` page, not a duplicate.

### 3. Staff/Roles management (see 2026-09-03 update above for the MANAGER-role extension)
New `adminUser.service.ts` + `staff.routes.ts` (ADMIN-only CRUD over `AdminUser`, reusing existing `hashPassword`). Guards: can't delete own account, can't delete the last remaining ADMIN, password/role changes revoke standing refresh-token sessions. New `/staff` admin page. Verified live including a real "delete the only other admin, promote a second one, confirm it works" test sequence — had to restore the original seeded `admin` account afterward since a test deletion removed it.

### 4. Dashboard/Analytics
Discovered `getOrderStatistics()`, `getInventorySummary()`, `getShipmentStatistics()` already existed and were already exposed via routes AND already had matching `apps/web/lib/api.ts` client functions — the dashboard was purely a wiring + one new piece problem. Added the one missing piece: `getTopProducts()` in `order.service.ts` (revenue/units by product, computed in JS from raw order-item rows since Prisma's groupBy has no "sum of quantity × unitPriceCents" aggregate). New `GET /api/orders/top-products` route. Dashboard page rebuilt from a 15-line stub into stat tiles + an orders-by-status bar chart + a top-products bar chart, using the existing `ink`/`brand` Tailwind tokens. Verified live against ~800 seeded orders; top-products query ran in ~55ms.

### 5. Tax at checkout
New `TaxRule` model (flat per-country rate, same shape as `CarrierRule`/`PaymentMethodRule` — a country with no rule has no tax). `pricing.service.ts`'s `priceCart()` gained a `shippingCountry` parameter; tax is computed on the discounted subtotal, before shipping is added. New `taxRule.service.ts` + `taxRules.routes.ts` (admin CRUD), new Tax Rules section in Configuration. `coupons.routes.ts`'s `/validate` endpoint extended to accept optional `shippingCountry` and return `taxCents`. Seeder: US 7.25%, DE 19% VAT, FR 20% VAT; CA/AU deliberately unconfigured to demonstrate the no-rule default. Verified live: tax math correct via both the preview endpoint and a real `checkout()` call.

---

## Known still-uncommitted, unrelated work (not mine — leave alone unless asked)
As of this session, `git status` still shows a separate body of storefront work sitting uncommitted in the working tree: `apps/webshop`'s cart/shop/category/search/product pages, Header/Footer/ProductCard, three new components (Breadcrumbs, SortControl, StarRating), and a change to `apps/api/src/services/product.service.ts`. This was already there before the 2026-09-02 session started and has been left untouched across two sessions now — confirmed with the user once (2026-09-02) to commit only the admin-features work and leave this alone. Still applies; don't fold it into future commits without asking.
