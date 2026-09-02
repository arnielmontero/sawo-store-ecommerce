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

export interface Product {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  basePriceCents: number;
  compareAtPriceCents: number | null;
  currency: string;
  imageUrl: string | null;
  featuredImageUrl: string | null;
  category: { id: number; name: string; slug: string } | null;
  tags: Tag[];
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
  totalCents: number;
  appliedCoupon: { id: number; code: string; type: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING" } | null;
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
  items: { variantId: number; quantity: number }[]
): Promise<CouponPreview> {
  const res = await fetch(`${API_URL}/api/v1/coupons/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, items }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  }
  return data;
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
  const products = [...first.products];
  for (let page = 2; page <= first.pagination.totalPages; page++) {
    const next = await fetchProducts({ ...params, page });
    products.push(...next.products);
  }
  return products;
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
