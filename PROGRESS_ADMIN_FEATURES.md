# Admin feature completeness — progress log

Working through 6 e-commerce admin feature gaps identified 2026-09-02, one at a time (plan → implement → seed → verify live → next). User instruction: no static/hardcoded demo data, every feature needs a seeder update so it's testable against realistic data.

## Status

1. **Discounts/Promotions** — ✅ DONE, fully verified live
2. **Reviews admin UI** — ✅ DONE, fully verified live
3. **Staff/Roles management** — ✅ DONE, fully verified live
4. **Dashboard/Analytics** — ✅ DONE, fully verified live
5. **Tax at checkout** — ✅ DONE, fully verified live
6. **Invoice/receipt generation** — 🟡 IN PROGRESS, see "Where we stopped" below

Sidebar was also regrouped into collapsible sections (Sales / Catalog / Fulfillment / People) as part of this pass, per user request to organize into sub-menus.

---

## Where we stopped (mid-feature 6: Invoice/receipt generation)

**Just completed:** typecheck of `apps/web` passed cleanly after adding the "Download invoice" button to the order detail page (`apps/web/app/(admin)/orders/[id]/page.tsx`). This was the last action taken.

**Not yet done for feature 6:**
- [ ] Typecheck `apps/api` one more time after all invoice changes (was clean as of the pdfkit + route + service additions, but worth re-confirming nothing drifted)
- [ ] **Verify live**: log in, call `GET /api/orders/:id/invoice` against a real seeded order, confirm it returns a valid PDF (check `Content-Type: application/pdf`, non-trivial byte size, actually open/inspect the PDF content — line items, totals, tax/discount lines all render correctly)
- [ ] Manually sanity-check the PDF layout doesn't overflow/clip for an order with many line items (pdfkit's y-cursor in `apps/api/src/lib/invoicePdf.ts` has no page-break handling — an order with ~15+ items could run off the bottom of the A4 page and needs a `doc.addPage()` check, not yet added)
- [ ] No seeder change needed for this feature — invoices are generated on-demand from existing order data, nothing new to seed
- [ ] Once verified, do a final full-suite typecheck across all three apps (`apps/api`, `apps/web`, `apps/webshop`) as a last sanity pass
- [ ] Update long-term memory (`C:\Users\WEB\.claude\projects\c--JS-sawo-store-ecommerce\memory\project_admin_feature_roadmap.md`) to mark all 6 done — currently only reflects Discounts as done, needs the other 5 folded in

## Files touched by feature 6 (Invoice/receipt generation)

- `apps/api/package.json` — added `pdfkit` + `@types/pdfkit` (new production dependency, installed and confirmed working)
- `apps/api/src/lib/invoicePdf.ts` — new file, `buildInvoicePdf(order, storeName)` builds a one-page PDF Buffer (header, line items table, subtotal/discount/shipping/tax/total, refunded-amount line)
- `apps/api/src/routes/orders.routes.ts` — added `GET /:id/invoice` (auth-gated like all other order routes), registered `getStoreSettings` and `buildInvoicePdf` imports
- `apps/web/lib/api.ts` — added `fetchInvoiceUrl(orderId)` (blob-download pattern, mirrors existing `exportOrdersCsvUrl`)
- `apps/web/app/(admin)/orders/[id]/page.tsx` — added "Download invoice" button next to the status-transition buttons in the page header; restructured that flex row's JSX (fragment wrapping) to fit the new button in

## Known design decision from this feature

Asked the user PDF library vs. HTML-print-to-PDF; user chose **pdfkit** (programmatic PDF generation, no browser/headless-Chrome dependency). This added one new production dependency — flagged and confirmed with the user before installing, consistent with this session's "ask before adding new deps" pattern (also applied earlier when I declined to install Playwright for UI screenshot verification without asking).

---

## Quick recap of features 1–5 (all done, for context if picking this up fresh)

### 1. Discounts/Promotions
`Coupon` model (percentage/fixed/free-shipping, optional date window, optional maxUses, tracked usageCount) wired into `pricing.service.ts` + `order.service.ts` (atomic usage-increment transaction with concurrency guard against overrunning maxUses — a stock-reservation-leak bug was caught and fixed here). Admin CRUD at `/api/v1/coupons` + public `/coupons/validate` preview endpoint. New `/coupons` admin page. Storefront checkout got a promo-code input with live preview (final order submission stays the pre-existing mock — storefront checkout has never called a real order-creation API, that's a separate pre-existing gap not in scope). Seeder: 5 demo coupons covering every type + every rejection path.

### 2. Reviews admin UI
Backend (`Review`/`ProductQuestion` models, full routes) already existed — this was UI-only. New `/reviews` admin page (two tabs: Reviews, Questions) with product-search-driven "log new" forms, purchaser picker (verified-purchase gate), delete/moderate for reviews, answer flow for questions. Discovered `apps/web/lib/api.ts` already had matching client functions/types from earlier unfinished work — reused rather than duplicated. Note: a separate `ReviewsAndQnaPanel.tsx` component already existed too, but it's a per-product embedded panel (used on product detail pages) — complementary to the new global cross-product `/reviews` page, not a duplicate.

### 3. Staff/Roles management
New `adminUser.service.ts` + `staff.routes.ts` (ADMIN-only CRUD over `AdminUser`, reusing existing `hashPassword`). Guards: can't delete own account, can't delete the last remaining ADMIN, password/role changes revoke standing refresh-token sessions. New `/staff` admin page (ADMIN-only, hidden from non-admin nav via a new `adminOnly` flag on Sidebar nav items). Verified live including a real "delete the only other admin, promote a second one, confirm it works" test sequence — had to restore the original seeded `admin` account afterward since a test deletion removed it (recreated with identical username/password/role, confirmed nothing else references the old numeric id).

### 4. Dashboard/Analytics
Discovered `getOrderStatistics()`, `getInventorySummary()`, `getShipmentStatistics()` already existed and were already exposed via routes AND already had matching `apps/web/lib/api.ts` client functions — the dashboard was purely a wiring + one new piece problem, not a build-everything-from-scratch problem. Added the one missing piece: `getTopProducts()` in `order.service.ts` (revenue/units by product, computed in JS from raw order-item rows since Prisma's groupBy has no "sum of quantity × unitPriceCents" aggregate — verified this matters, an earlier draft using a misleading `_sum` was caught and rewritten before shipping). New `GET /api/orders/top-products` route. Dashboard page rebuilt from a 15-line stub into stat tiles (revenue, orders, AOV, new customers, unread notifications, low/out-of-stock, pending shipment) + an orders-by-status bar chart + a top-products bar chart, using the existing `ink`/`brand` Tailwind tokens and the codebase's existing ad hoc status-color convention rather than introducing a new design system. Verified live against ~800 seeded orders; top-products query ran in ~55ms.

### 5. Tax at checkout
New `TaxRule` model (flat per-country rate, same shape as `CarrierRule`/`PaymentMethodRule` — a country with no rule has no tax, matching that existing "absence = no restriction" convention). `pricing.service.ts`'s `priceCart()` gained a `shippingCountry` parameter; tax is computed on the discounted subtotal (subtotal − coupon discount), before shipping is added. New `taxRule.service.ts` + `taxRules.routes.ts` (admin CRUD), new Tax Rules section added to the Configuration page (mirrors the existing Carrier Rules UI). `coupons.routes.ts`'s `/validate` endpoint extended to accept optional `shippingCountry` and return `taxCents` too, so the same preview call covers both discount and tax. Seeder: US 7.25%, DE 19% VAT, FR 20% VAT; CA/AU deliberately left unconfigured to demonstrate the no-rule default. Verified live: tax math correct both via the validate-preview endpoint and via a real `checkout()` call, interaction with existing coupon discount and EU payment-method restrictions both confirmed correct.

**Mid-session infra note:** had to `taskkill` and restart the already-running `apps/api` dev server once, because `prisma generate` couldn't overwrite the query-engine DLL while the running server held it open (this happened when regenerating the Prisma client after adding `TaxRule` to the schema). Routine, low-risk, server came back up fine via `npm run dev` in watch mode.
