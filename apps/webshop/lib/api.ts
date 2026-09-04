// Read-only client for the storefront — every function here is a GET
// against the same Express API apps/web talks to, just restricted to the
// public (unauthenticated) routes. No writes: this app never creates,
// updates, or deletes catalog data — that only ever happens from the admin
// backoffice (apps/web).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface Category {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  _count: { products: number };
  children: Category[];
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
}

export interface ProductImage {
  id: number;
  url: string;
  position: number;
  isFeatured: boolean;
}

// Just enough to "quick add" a single-variant product straight from a grid
// card — the full variant shape (sale windows, weight, etc.) lives on
// ProductDetail; this stays deliberately thin. Stock is nested under
// `inventory` here (matches the raw ProductVariant/Inventory relation the
// API's list endpoint returns), unlike ProductDetail's VariantDetail which
// flattens it into a computed availableStock.
export interface ProductListVariant {
  id: number;
  priceCents: number;
  inventory: { stockQuantity: number; reservedQuantity: number } | null;
}

export interface Product {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  basePriceCents: number;
  compareAtPriceCents: number | null;
  // Null unless admin actually set a sale window — never fabricated
  // client-side. A Flash Deals countdown only renders when this is present.
  saleEndsAt: string | null;
  currency: string;
  imageUrl: string | null;
  featuredImageUrl: string | null;
  category: { id: number; name: string; slug: string } | null;
  tags: Tag[];
  variants: ProductListVariant[];
  variantCount: number;
  totalStock: number;
  rating: number | null;
  reviewCount: number;
  isBestSeller: boolean;
  isNew: boolean;
  isOnSale: boolean;
}

export interface ProductsPage {
  products: Product[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface VariantDetail {
  id: number;
  sku: string;
  priceCents: number;
  attributes: Record<string, string> | null;
  imageUrl: string | null;
  compareAtPriceCents: number | null;
  isOnSale: boolean;
  availableStock: number;
}

// Author names arrive already masked by the API (the underlying admin row
// stores the customer's email) — the storefront just renders what it's given.
export interface ProductReview {
  id: number;
  authorName: string;
  rating: number;
  body: string;
  createdAt: string;
}

// Only questions staff have actually answered are returned publicly.
export interface ProductQA {
  id: number;
  authorName: string;
  question: string;
  answer: string | null;
  answeredByName: string | null;
  answeredAt: string | null;
  createdAt: string;
}

export interface ProductDetail {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  basePriceCents: number;
  compareAtPriceCents: number | null;
  currency: string;
  imageUrl: string | null;
  category: { id: number; name: string; slug: string } | null;
  images: ProductImage[];
  variants: VariantDetail[];
  reviews: ProductReview[];
  questions: ProductQA[];
  rating: number | null;
  reviewCount: number;
  isBestSeller: boolean;
  isNew: boolean;
  isOnSale: boolean;
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    // No credentials/auth header — the storefront never authenticates
    // against the admin API, it only reads public routes.
    headers: { ...init?.headers },
    // Product data changes via the admin app between visits; a short
    // revalidation window keeps pages fast without ever going fully stale.
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export interface CouponPreview {
  discountCents: number;
  shippingCents: number;
  shippingServiceName: string | null;
  isShippingEstimate: boolean;
  taxCents: number;
  totalCents: number;
  appliedCoupon: { id: number; code: string; type: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING" } | null;
}

export interface ShippingAddressInput {
  street1: string;
  city: string;
  state: string;
  postalCode: string;
}

// The one exception to this file's "read-only" scope above: this doesn't
// create/update/delete anything, it's a stateless preview of what a coupon
// code would do to the current cart (see coupons.routes.ts's public
// /validate route, backed by pricing.service.ts's priceCart — the same
// validation checkout() itself runs, just without creating an order or
// consuming a use). POST because the cart's line items don't fit in a
// query string, not because it mutates anything server-side.
export async function validateCoupon(
  code: string,
  items: { variantId: number; quantity: number }[],
  shippingCountry?: string,
  address?: ShippingAddressInput
): Promise<CouponPreview> {
  const res = await fetch(`${API_URL}/api/v1/coupons/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, items, shippingCountry, address }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  }
  return data;
}

// Real shipping cost preview — no coupon required, no order created. See
// shippingQuote.routes.ts. Never throws for a "no quote available"
// situation (falls back to $0 shipping server-side); only throws on a
// genuine request failure (network, malformed input).
export interface ShippingQuote {
  shippingCents: number;
  serviceName: string | null;
  isEstimate: boolean;
  // True when the store is in Sandbox mode — lets checkout show a small
  // "test mode" note near the address fields so a tester never mistakes a
  // sandbox quote for a real production charge.
  isSandbox: boolean;
}

export async function fetchShippingQuote(input: {
  items: { variantId: number; quantity: number }[];
  shippingCountry: string;
  address?: ShippingAddressInput;
}): Promise<ShippingQuote> {
  const res = await fetch(`${API_URL}/api/v1/shipping-quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  }
  return data;
}

// ── Checkout & order tracking ──────────────────────────────────────────
//
// The other exception to this file's read-only scope: checkout genuinely
// creates an Order. The API re-prices every line server-side and reserves
// stock itself (order.service.ts's checkout), so nothing the browser sends
// about prices is trusted — the cart only supplies variant ids and
// quantities.

// Matches the API's PaymentMethod enum exactly (prisma/schema.prisma).
export type PaymentMethod = "CARD" | "PAYPAL" | "BANK" | "PAY_WITH_CHECK";

export interface PlacedOrder {
  id: number;
  reference: string;
  status: string;
  totalCents: number;
  currency: string;
}

export async function placeOrder(input: {
  items: { variantId: number; quantity: number }[];
  paymentMethod: PaymentMethod;
  shippingAddress: string;
  shippingCountry: string;
  shippingAddressStructured?: ShippingAddressInput;
  couponCode?: string;
}): Promise<PlacedOrder> {
  const res = await fetch(`${API_URL}/api/orders/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? `Checkout failed (${res.status})`);
  }
  return data.order;
}

export interface TrackedOrder {
  reference: string;
  status: string;
  placedAt: string;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  trackingNumber: string | null;
  carrier: string | null;
  deliveryStatus: string | null;
  trackingUrl: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  items: {
    productTitle: string;
    productSlug: string;
    sku: string;
    quantity: number;
    unitPriceCents: number;
  }[];
  timeline: { status: string; changedAt: string }[];
}

// Returns null (rather than throwing) for an unknown reference so the
// tracking page can show "we couldn't find that order" instead of an error.
export async function trackOrder(reference: string): Promise<TrackedOrder | null> {
  const res = await fetch(`${API_URL}/api/orders/track/${encodeURIComponent(reference)}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? `Lookup failed (${res.status})`);
  }
  return data.order;
}

export async function fetchCategoryTree(): Promise<Category[]> {
  const data = await apiFetch("/api/v1/products/categories");
  return data.categories;
}

export type ProductSortField = "name" | "price" | "stock" | "createdAt";
export type SortDir = "asc" | "desc";

export async function fetchProducts(
  params: {
    category?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    sortBy?: ProductSortField;
    sortDir?: SortDir;
  } = {}
): Promise<ProductsPage> {
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  if (params.search) query.set("search", params.search);
  if (params.minPrice !== undefined) query.set("minPrice", String(params.minPrice));
  if (params.maxPrice !== undefined) query.set("maxPrice", String(params.maxPrice));
  if (params.page) query.set("page", String(params.page));
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.sortDir) query.set("sortDir", params.sortDir);
  const qs = query.toString();
  return apiFetch(`/api/v1/products${qs ? `?${qs}` : ""}`);
}

// The listing endpoint paginates (PAGE_SIZE=20 server-side) — grid pages
// that should show the admin's ENTIRE catalog (not just page 1) walk every
// page here rather than truncating at 20 products.
export async function fetchAllProducts(
  params: {
    category?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    sortBy?: ProductSortField;
    sortDir?: SortDir;
  } = {}
): Promise<Product[]> {
  const first = await fetchProducts({ ...params, page: 1 });
  if (first.pagination.totalPages <= 1) return first.products;

  // Remaining pages are independent requests (each page is server-sorted on
  // its own params, not dependent on a previous page's result), so fetch
  // them in parallel instead of one round-trip at a time — this used to be
  // a serial `for` loop, which meant catalog page load time grew linearly
  // with page count instead of being bounded by the slowest single request.
  const remainingPages = Array.from(
    { length: first.pagination.totalPages - 1 },
    (_, i) => i + 2
  );
  const rest = await Promise.all(remainingPages.map((page) => fetchProducts({ ...params, page })));
  return [...first.products, ...rest.flatMap((page) => page.products)];
}

export async function fetchProduct(slug: string): Promise<ProductDetail | null> {
  try {
    const data = await apiFetch(`/api/v1/products/${slug}`);
    return data.product;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}
