# Shipping, labels, and checkout pricing — progress log

Tracks the ShipStation/ShipEngine integration and real checkout shipping
cost work, separate from `PROGRESS_ADMIN_FEATURES.md` (the original 6-item
admin-parity list). Started 2026-09-03 after testing surfaced that checkout
charged $0 shipping unconditionally while a real ShipEngine label cost
$8.07 to buy — a pure loss on every order. One session, several rounds of
build → live-verify → fix.

## Status — 2026-09-03: all of the below is DONE and live-verified

---

## 1. ShipStation delivery provider (config)

Added ShipStation/ShipEngine as a second selectable delivery provider
alongside EasyPost, in Configuration:
- `StoreSettings.deliveryProvider` (`EASYPOST` | `SHIPSTATION`), a
  Sandbox/Production-style toggle in Configuration.
- ShipStation API key field — **single key, not key+secret** (corrected
  mid-session after initially assuming EasyPost's key+secret shape; verified
  against ShipEngine's real docs).
- Delivery-provider-aware carrier dropdown on Deliveries → Pending: when
  ShipStation is active, only carriers actually **connected** on the real
  ShipEngine account (live `GET /v1/carriers` call, not a static guess) are
  selectable — confirmed against the real test account, which only has
  USPS + UPS connected, not FedEx/DHL.

## 2. Real ShipEngine tracking

`apps/api/src/lib/shipengine.ts` — tracking parity with the existing
EasyPost integration:
- `createShipEngineTracker` / `getShipEngineTrackingStatus` (`POST
  /v1/tracking/start`, `GET /v1/tracking`), normalized to the same
  status vocabulary EasyPost already used so `shipping.service.ts`'s
  refresh logic didn't need a second branch.
- **Known platform limitation, not a bug:** ShipEngine's sandbox has NO
  simulated tracking data (confirmed from their own docs) — unlike
  EasyPost's fixed test tracking code, a fake ShipEngine tracking number
  just stays "unknown" forever. Real carrier movement is required to see
  status progress in this environment.
- Also found and fixed: ShipEngine's Tracking endpoint returned a real
  403 ("Advanced plan or higher") on this account's Trial tier — the
  error message is now generic/parameterized per endpoint rather than
  hardcoded to Tracking's specific wording, since Labels/Rates can have
  different plan requirements.

## 3. Real ShipEngine label purchase (auto-generates tracking numbers)

Replaced manual tracking-number typing with a real "Buy label" flow —
per explicit user requirement, the tracking number is **read-only** once
generated, never an editable field.

- Schema: `ProductVariant.weight` (oz, nullable, `DEFAULT_WEIGHT_OZ = 16`
  fallback), `StoreSettings.shipFrom*` (name/phone/street1/street2/city/
  state/zip/country — the store's origin address), `Order.labelPurchasedAt/
  labelUrl/shipEngineLabelId/shippingCostCents/shippingCostCurrency`.
- `buyShipEngineLabel` (`shipengine.ts`) calls the real `POST /v1/labels`,
  does NOT swallow errors (unlike the best-effort tracker functions) —
  a label purchase spends real money, failures must reach the admin.
- Label PDF is downloaded server-side and re-hosted from this app's own
  `/uploads` dir (ShipEngine's hosted URL isn't guaranteed to stay valid).
- Address auto-parsed from `Order.shippingAddress` (free text, regex
  heuristic) with a **mandatory admin-review panel** before any purchase
  — inline expandable row on Deliveries → Pending, editable fields,
  confirmed carrier, "Confirm purchase" button.
- **Rate quote added before purchase** (user caught that "Confirm
  purchase" showed no price — a real, legitimate gap): a new
  `getLabelQuote`/`getShipEngineRateQuote` (`POST /v1/rates`) call fires
  live as the admin edits the review panel, showing the real service name
  + price + delivery estimate before the purchase button is even
  clickable. Verified quoted price == actual charged price, exact match
  (807 cents both times, live test).
- Bulk-ship stays EasyPost-only by design — a real per-order money spend
  with mandatory review is incompatible with an unattended bulk loop.
- **Live-verified with REAL purchases** on the test ShipEngine account:
  USPS ($8.07, tracking `9334689956300000344833`) and UPS (test tracking
  format `1ZXXXXXXXXXXXXXXXX`) labels were actually bought during testing
  — these are real sandbox-account transactions, not simulated.

## 4. Real shipping cost at checkout (the big one)

**The core problem found:** `pricing.service.ts`'s `priceCart()` had
`shippingCents` hardcoded to `0`, unconditionally, for every order ever
placed. A real label costs money; the customer was never charged for it.
Confirmed via research this was a genuine, never-built feature (not a
disabled/broken one) — explicitly stubbed with a "no carrier-rate source
exists yet" comment.

**Design** (confirmed with user before building):
- Early estimate: as soon as a country is picked at checkout, a real
  ShipEngine quote against a representative address for that country
  (NOT the customer's real address yet).
- Final accurate quote: once the customer finishes typing their full
  street address, a live quote for that EXACT destination replaces the
  estimate — before they can pay.
- If ship-from isn't configured, or ShipEngine fails for any reason:
  silently fall back to $0 shipping (today's old behavior) and log a
  warning — checkout must never break for a real customer over a shipping
  quote failure.
- ShipStation-only, matching the rest of this session's scope — EasyPost's
  flow is completely untouched.

**Built:**
- `apps/api/src/lib/representativeCities.ts` — one representative
  **full street address** per country (not just city/state/zip — a live
  test against ShipEngine's real API confirmed an empty `street1` gets
  the whole quote rejected outright, not just approximated).
- `apps/api/src/lib/shippingQuote.ts` — `getShippingQuote()`, the shared
  quote logic: resolves delivery provider, ship-from config, carrier
  (`assignCarrier`), variant weight sum, calls the real ShipEngine rate
  endpoint, never throws (always falls back to $0 on any failure).
- `pricing.service.ts`'s `priceCart()` gained a 4th optional param
  (structured address) and now calls `getShippingQuote` instead of the
  `= 0` stub — `PricingResult` gained `shippingServiceName`/
  `isShippingEstimate`. `FREE_SHIPPING` coupons still force $0, unchanged.
- New public, rate-limited endpoint `POST /api/v1/shipping-quote` — lets
  the storefront preview shipping cost with zero side effects, before any
  order exists.
- `checkout()`/`CheckoutInput` gained `shippingAddressStructured` — the
  storefront form already collected street/city/state/zip, it just never
  reached the backend past the flattened free-text snapshot; now both are
  sent, so the SAME address used to accurately quote is what's charged.
- `/coupons/validate` extended to also accept/use the structured address,
  so the coupon-preview total reflects real shipping too, not just the
  final submission.
- Storefront (`apps/webshop`): replaced the free-text 2-letter country
  `<input>` with a real `<select>` (a genuine pre-existing gap, not just
  needed for this feature — a new `apps/webshop/lib/countries.ts`, no
  shared package exists between `apps/web`/`apps/webshop` so it's
  duplicated). New debounced quote-fetching effects (first `useEffect` in
  `checkout/page.tsx` — no existing pattern in that file). New "Shipping"
  line in the Order Summary with an "(estimated)" badge until the address
  is complete.
- **Sandbox indicator, scoped to the address section only** (explicit user
  request — "only the checkout side nothing else... the address thats
  all"): `getShippingQuote` result carries `isSandbox` (from
  `StoreSettings.apiEnvironment`), surfaced as a small amber note directly
  above the Shipping Address fields on checkout: *"Test mode — any address
  works here and shipping quotes are from a sandbox account, not real
  charges."* Disappears automatically once Configuration is switched to
  Production — no separate admin/webshop toggle needed, it's the same
  `apiEnvironment` flag that already governs Stripe/EasyPost/ShipEngine
  everywhere else.
- **Real bug caught during live testing, fixed same session:** the
  representative-address map initially had empty `street1` fields — every
  early-estimate quote silently fell back to $0 with `isEstimate: false`
  (looked like "shipping is free" instead of "we don't have a real quote
  yet"). Root-caused via server logs (`ShipEngine didn't return a rate`),
  confirmed with a manual test swapping in a real street address, then
  fixed by giving every country entry a real, well-known street address
  (e.g. US → "350 5th Ave, New York, NY 10001").

## 5. Seed data updated to match

- `seedSettings()`: seeded `shipFrom*` fields (Sawo Shop Warehouse, Austin
  TX) so a fresh install can demo real quotes/labels with zero manual
  Configuration steps.
- `seedCatalog()`: added realistic `weight` (oz) to every SKU actually
  referenced by seeded orders (heaters 288–560oz, control panels ~24oz,
  benches/backrests/doors 144–720oz, buckets/thermometer/lighting
  8–48oz) — deliberately NOT a mechanical rewrite of the entire catalog
  literal (dozens of unused-in-demo-orders SKUs still fall back to
  `DEFAULT_WEIGHT_OZ`), so demo shipping quotes are believably
  differentiated by product instead of uniform.
- Existing seeded orders' `shippingCents: 0` deliberately left as-is —
  they're historical demo orders that never went through the new quote
  flow; only new orders placed after this feature get real, non-zero
  shipping.

## Known limitations (platform, not code)

- ShipEngine sandbox has no simulated tracking progression — real carrier
  movement required to see In-Transit → Delivered happen live.
- This test account only has USPS + UPS connected — any order resolving
  to FedEx/DHL correctly falls back to $0 shipping (not a bug; same
  "never block checkout" fallback as a missing ship-from address). A real
  production account would need those carriers connected on ShipEngine's
  side to quote/charge for them.
- No package dimensions collected anywhere in this app — every ShipEngine
  request is weight-only. Fine for most USPS/UPS services; a known,
  accepted accuracy gap for bulky-but-light items.

## Everything typechecks clean

`apps/api`, `apps/web`, `apps/webshop` — all three `npx tsc --noEmit`
clean as of the end of this session.
