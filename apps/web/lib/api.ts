const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type AdminRole = "ADMIN" | "FULFILLMENT_STAFF";

export interface SessionUser {
  username: string;
  name: string;
  role: AdminRole;
}

export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED"
  | "RETURNED";
export type PaymentMethod = "PAY_WITH_CHECK" | "PAYPAL" | "BANK" | "CARD";

export interface Order {
  id: number;
  reference: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  totalCents: number;
  currency: string;
  isNewClient: boolean;
  createdAt: string;
  user: { email: string } | null;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
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
  basePriceCents: number;
  compareAtPriceCents: number | null;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  currency: string;
  imageUrl: string | null;
  featuredImageUrl: string | null;
  isActive: boolean;
  category: Category | null;
  tags: Tag[];
  variantCount: number;
  totalStock: number;
  createdAt: string;
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
  isActive: boolean;
  compareAtPriceCents: number | null;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  isOnSale: boolean;
  inventory: { stockQuantity: number; reservedQuantity: number } | null;
}

export interface ProductDetail {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  basePriceCents: number;
  compareAtPriceCents: number | null;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  currency: string;
  imageUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  sortOrder: number;
  isActive: boolean;
  categoryId: number | null;
  category: Category | null;
  tags: Tag[];
  images: ProductImage[];
  variants: VariantDetail[];
  createdAt: string;
  isBestSeller: boolean;
  isNew: boolean;
  isOnSale: boolean;
}

export interface UpdateProductInput {
  title?: string;
  slug?: string;
  description?: string;
  basePriceCents?: number;
  compareAtPriceCents?: number | null;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  currency?: string;
  imageUrl?: string;
  metaTitle?: string;
  metaDescription?: string;
  sortOrder?: number;
  categoryId?: number | null;
  isActive?: boolean;
  tags?: string[];
  variants?: Array<{
    id?: number;
    sku: string;
    priceCents: number;
    attributes?: Record<string, string>;
    imageUrl?: string | null;
    compareAtPriceCents?: number | null;
    saleStartsAt?: string | null;
    saleEndsAt?: string | null;
  }>;
}

export interface CreateProductInput {
  title: string;
  slug: string;
  description?: string;
  basePriceCents: number;
  compareAtPriceCents?: number;
  currency?: string;
  imageUrl?: string;
  metaTitle?: string;
  metaDescription?: string;
  categoryId?: number;
  tags?: string[];
  variants: Array<{
    sku: string;
    priceCents: number;
    attributes?: Record<string, string>;
    initialStock?: number;
    imageUrl?: string;
  }>;
}

export interface Customer {
  id: number;
  email: string;
  createdAt: string;
  orderCount: number;
  totalSpentCents: number;
}

export interface CustomersPage {
  customers: Customer[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface CustomerOrder extends Order {
  items: { id: number; variantId: number; quantity: number; unitPriceCents: number }[];
}

export interface CustomerDetail {
  id: number;
  email: string;
  createdAt: string;
  orders: CustomerOrder[];
}

export interface PendingShipment extends Order {
  items: { id: number; variantId: number; quantity: number; unitPriceCents: number }[];
}

export interface OrderDetailItem {
  id: number;
  variantId: number;
  quantity: number;
  unitPriceCents: number;
  variant: {
    id: number;
    sku: string;
    attributes: Record<string, string>;
    product: { title: string };
  };
}

export interface OrderDetail {
  id: number;
  reference: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod | null;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  shippingAddress: string | null;
  isNewClient: boolean;
  trackingNumber: string | null;
  stripePaymentIntentId: string | null;
  paymentAttemptCount: number;
  createdAt: string;
  user: { id: number; email: string } | null;
  items: OrderDetailItem[];
}

export interface Payment {
  id: number;
  reference: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  totalCents: number;
  currency: string;
  stripePaymentIntentId: string | null;
  paymentAttemptCount: number;
  createdAt: string;
}

// The access token lives only in memory (module-level variable), never in
// localStorage or a JS-readable cookie — that's the point of the short-lived
// JWT + HttpOnly refresh-cookie pattern: an XSS bug can't steal a long-lived
// credential. It's naturally cleared on a full page reload, at which point
// the caller re-establishes it via refreshAccessToken() (see auth-context).
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function apiFetch(path: string, options: RequestInit = {}) {
  // FormData sets its own multipart boundary Content-Type — forcing
  // application/json here would break file uploads, so only default to
  // JSON when the body isn't already a FormData instance.
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function login(username: string, password: string) {
  const data = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  return data as { accessToken: string; user: SessionUser };
}

// Uses the HttpOnly refresh cookie (sent automatically via credentials:
// "include") to obtain a new access token without re-entering credentials.
export async function refreshAccessToken() {
  const data = await apiFetch("/api/auth/refresh", { method: "POST" });
  return data as { accessToken: string; user: SessionUser };
}

export async function logout() {
  await apiFetch("/api/auth/logout", { method: "POST" });
}

export async function fetchMe(): Promise<SessionUser> {
  const data = await apiFetch("/api/auth/me");
  return data.user;
}

export async function fetchOrders(): Promise<Order[]> {
  const data = await apiFetch("/api/orders");
  return data.orders;
}

export type ProductSortField = "name" | "price" | "stock" | "createdAt";
export type SortDir = "asc" | "desc";

export async function fetchProducts(
  params: {
    category?: string;
    search?: string;
    page?: number;
    sortBy?: ProductSortField;
    sortDir?: SortDir;
  } = {}
): Promise<ProductsPage> {
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.sortDir) query.set("sortDir", params.sortDir);
  const qs = query.toString();
  return apiFetch(`/api/v1/products/admin${qs ? `?${qs}` : ""}`);
}

export async function fetchCategories(): Promise<Category[]> {
  const data = await apiFetch("/api/v1/products/admin/categories");
  return data.categories;
}

export async function fetchTags(): Promise<Tag[]> {
  const data = await apiFetch("/api/v1/products/admin/tags");
  return data.tags;
}

export async function fetchProduct(id: number): Promise<ProductDetail> {
  const data = await apiFetch(`/api/v1/products/admin/${id}`);
  return data.product;
}

export async function createProduct(input: CreateProductInput): Promise<ProductDetail> {
  const data = await apiFetch("/api/v1/products", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.product;
}

export async function updateProduct(id: number, input: UpdateProductInput): Promise<ProductDetail> {
  const data = await apiFetch(`/api/v1/products/admin/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return data.product;
}

export async function deactivateProduct(id: number): Promise<void> {
  await apiFetch(`/api/v1/products/admin/${id}`, { method: "DELETE" });
}

export async function setVariantStock(variantId: number, stockQuantity: number) {
  const data = await apiFetch(`/api/v1/products/admin/variants/${variantId}/stock`, {
    method: "PATCH",
    body: JSON.stringify({ stockQuantity }),
  });
  return data.inventory as { variantId: number; stockQuantity: number; reservedQuantity: number };
}

export async function setVariantActive(variantId: number, isActive: boolean) {
  const data = await apiFetch(`/api/v1/products/admin/variants/${variantId}/active`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
  return data.variant as VariantDetail;
}

// ── Product images ────────────────────────────────────────────────────

export async function uploadProductImage(productId: number, file: File): Promise<ProductImage> {
  const formData = new FormData();
  formData.append("file", file);
  const data = await apiFetch(`/api/v1/products/admin/${productId}/images`, {
    method: "POST",
    body: formData,
  });
  return data.image;
}

export async function deleteProductImage(productId: number, imageId: number): Promise<void> {
  await apiFetch(`/api/v1/products/admin/${productId}/images/${imageId}`, { method: "DELETE" });
}

export async function setFeaturedImage(productId: number, imageId: number): Promise<void> {
  await apiFetch(`/api/v1/products/admin/${productId}/images/${imageId}/feature`, { method: "PATCH" });
}

export async function reorderProductImages(productId: number, orderedImageIds: number[]): Promise<void> {
  await apiFetch(`/api/v1/products/admin/${productId}/images/reorder`, {
    method: "PATCH",
    body: JSON.stringify({ orderedImageIds }),
  });
}

// ── Variant matrix ────────────────────────────────────────────────────

export async function generateVariantMatrix(
  productId: number,
  options: Array<{ name: string; values: string[] }>
): Promise<ProductDetail> {
  const data = await apiFetch(`/api/v1/products/admin/${productId}/variants/generate`, {
    method: "POST",
    body: JSON.stringify({ options }),
  });
  return data.product;
}

// ── Bulk actions ───────────────────────────────────────────────────────

export async function bulkSetActive(productIds: number[], isActive: boolean): Promise<void> {
  await apiFetch(`/api/v1/products/admin/bulk/${isActive ? "activate" : "deactivate"}`, {
    method: "POST",
    body: JSON.stringify({ productIds }),
  });
}

export async function bulkSetCategory(productIds: number[], categoryId: number | null): Promise<void> {
  await apiFetch("/api/v1/products/admin/bulk/category", {
    method: "POST",
    body: JSON.stringify({ productIds, categoryId }),
  });
}

export async function bulkAdjustPrice(productIds: number[], percent: number): Promise<void> {
  await apiFetch("/api/v1/products/admin/bulk/price", {
    method: "POST",
    body: JSON.stringify({ productIds, percent }),
  });
}

// ── CSV import/export ────────────────────────────────────────────────

export async function exportProductsCsvUrl(): Promise<string> {
  const res = await fetch(`${API_URL}/api/v1/products/admin/export`, {
    credentials: "include",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, "Failed to export catalog");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export interface CsvImportResult {
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  errors: string[];
}

export async function importProductsCsv(file: File): Promise<CsvImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch("/api/v1/products/admin/import", { method: "POST", body: formData });
}

export async function fetchOrder(id: number): Promise<OrderDetail> {
  const data = await apiFetch(`/api/orders/${id}`);
  return data.order;
}

export async function updateOrderStatus(id: number, status: OrderStatus): Promise<OrderDetail> {
  const data = await apiFetch(`/api/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return data.order;
}

export async function fetchCustomers(page = 1): Promise<CustomersPage> {
  return apiFetch(`/api/v1/customers?page=${page}`);
}

export async function fetchCustomer(id: number): Promise<CustomerDetail> {
  const data = await apiFetch(`/api/v1/customers/${id}`);
  return data.customer;
}

export async function fetchPendingShipments(): Promise<PendingShipment[]> {
  const data = await apiFetch("/api/v1/shipping/pending");
  return data.orders;
}

export async function shipOrder(orderId: number, trackingNumber: string): Promise<Order> {
  const data = await apiFetch(`/api/v1/shipping/${orderId}/ship`, {
    method: "PATCH",
    body: JSON.stringify({ trackingNumber }),
  });
  return data.order;
}

export async function fetchPayments(): Promise<Payment[]> {
  const data = await apiFetch("/api/v1/payments");
  return data.payments;
}

export async function refundPayment(orderId: number): Promise<Order> {
  const data = await apiFetch("/api/v1/payments/refund", {
    method: "POST",
    body: JSON.stringify({ orderId }),
  });
  return data.order;
}

export interface StoreSettings {
  storeName: string;
  logoUrl: string | null;
}

export async function fetchStoreSettings(): Promise<StoreSettings> {
  const data = await apiFetch("/api/v1/settings");
  return data.settings;
}

export async function updateStoreSettings(storeName: string): Promise<StoreSettings> {
  const data = await apiFetch("/api/v1/settings", {
    method: "PATCH",
    body: JSON.stringify({ storeName }),
  });
  return data.settings;
}

export async function uploadStoreLogo(file: File): Promise<StoreSettings> {
  const formData = new FormData();
  formData.append("file", file);
  const data = await apiFetch("/api/v1/settings/logo", { method: "POST", body: formData });
  return data.settings;
}

export async function removeStoreLogo(): Promise<StoreSettings> {
  const data = await apiFetch("/api/v1/settings/logo", { method: "DELETE" });
  return data.settings;
}
