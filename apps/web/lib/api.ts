const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type AdminRole = "ADMIN" | "MANAGER" | "FULFILLMENT_STAFF";

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
  | "RETURNED"
  | "PARTIALLY_REFUNDED";
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
  // Present when fetched via fetchCategories() (includes the product
  // count); absent on categories embedded elsewhere (e.g. Product.category)
  // that don't need it.
  _count?: { products: number };
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
  name: string | null;
  createdAt: string;
  orderCount: number;
  totalSpentCents: number;
  // Total quantity across this customer's staff-logged cart-interest leads
  // — not a real live cart (see CartLead in schema.prisma), just "how many
  // units are currently on hold, not yet checked out."
  cartItemCount: number;
  // Combined reviews + questions this customer has left, across every
  // product — the detail page breaks these out individually.
  feedbackCount: number;
}

export interface CustomersPage {
  customers: Customer[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface CustomerOrderItem {
  id: number;
  variantId: number;
  quantity: number;
  unitPriceCents: number;
  variant: { sku: string; product: { id: number; title: string } };
}

// Card metadata comes from Stripe's own expanded payment_method — never raw
// card numbers, this app's Stripe integration never has PCI scope over
// those (see payment.service.ts's recordCardMetadata). Null for orders that
// never reached a real Stripe charge.
export interface CustomerOrder extends Order {
  items: CustomerOrderItem[];
  refunds: { id: number; amountCents: number; createdAt: string }[];
  cardBrand: string | null;
  cardLast4: string | null;
  paymentStatus: string | null;
  paymentDeclineCode: string | null;
}

export interface ProductPurchaseSummary {
  productId: number;
  productTitle: string;
  quantity: number;
  totalSpentCents: number;
}

export interface CustomerDetail {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  createdAt: string;
  orders: CustomerOrder[];
  totalSpentCents: number;
  productsPurchased: ProductPurchaseSummary[];
  reviews: Review[];
  questions: ProductQuestion[];
  cartLeads: CartLead[];
}

export interface UpdateCustomerProfileInput {
  name?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export async function updateCustomerProfile(id: number, input: UpdateCustomerProfileInput): Promise<CustomerDetail> {
  const data = await apiFetch(`/api/v1/customers/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  return data.customer;
}

// ── Cart leads ─────────────────────────────────────────────────────────
// Staff-logged record of items a customer said they wanted but hadn't
// bought yet — there's no real add-to-cart flow in this admin-only app
// (see schema.prisma's CartLead model), so this is a lead, not a live cart.

export interface CartLeadItem {
  id: number;
  variantId: number;
  quantity: number;
  variant: { sku: string; priceCents: number; product: { id: number; title: string } };
}

export interface CartLead {
  id: number;
  userId: number;
  loggedByName: string;
  note: string | null;
  createdAt: string;
  items: CartLeadItem[];
}

export async function fetchCartLeads(userId: number): Promise<CartLead[]> {
  const data = await apiFetch(`/api/v1/customers/${userId}/cart-leads`);
  return data.cartLeads;
}

export async function logCartLead(
  userId: number,
  items: { variantId: number; quantity: number }[],
  note?: string
): Promise<CartLead> {
  const data = await apiFetch(`/api/v1/customers/${userId}/cart-leads`, {
    method: "POST",
    body: JSON.stringify({ items, note }),
  });
  return data.cartLead;
}

export async function deleteCartLead(leadId: number): Promise<void> {
  await apiFetch(`/api/v1/customers/cart-leads/${leadId}`, { method: "DELETE" });
}

export type ShipmentTab = "pending" | "in-transit" | "history";
export type ShipmentSortField = "createdAt" | "paidAt" | "updatedAt" | "totalCents";
export type OverdueReason = "paid_too_long" | "shipped_too_long" | null;

// Populated tracking/delivery fields mean either the order hasn't shipped
// yet, or EASYPOST_API_KEY isn't configured (see lib/easypost.ts) — never a
// failed live call.
export interface Shipment {
  id: number;
  reference: string;
  status: OrderStatus;
  totalCents: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  shippingCountry: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  easypostTrackingUrl: string | null;
  deliveryStatus: string | null;
  items: { id: number; variantId: number; quantity: number; unitPriceCents: number }[];
  isOverdue: boolean;
  overdueReason: OverdueReason;
}

export interface ShipmentsPage {
  shipments: Shipment[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface ShipmentStatistics {
  pendingCount: number;
  inTransitCount: number;
  deliveredThisWeekCount: number;
  avgPaidToShipHours: number | null;
}

export interface CarrierRule {
  id: number;
  country: string;
  carrier: string;
}

export type CouponType = "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING";

export interface Coupon {
  id: number;
  code: string;
  type: CouponType;
  value: number | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  maxUses: number | null;
  usageCount: number;
  createdAt: string;
}

export interface CouponInput {
  code: string;
  type: CouponType;
  value?: number;
  startsAt?: string;
  endsAt?: string;
  maxUses?: number;
}

export interface PaymentMethodRule {
  id: number;
  country: string;
  paymentMethod: PaymentMethod;
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
  shippingCountry: string | null;
  carrier: string | null;
  isNewClient: boolean;
  trackingNumber: string | null;
  deliveryStatus: string | null;
  easypostTrackingUrl: string | null;
  stripePaymentIntentId: string | null;
  paymentAttemptCount: number;
  createdAt: string;
  user: { id: number; email: string } | null;
  items: OrderDetailItem[];
  statusHistory: { id: number; status: OrderStatus; changedAt: string }[];
  notes: { id: number; body: string; authorName: string; createdAt: string }[];
  refundedCents: number;
  refunds: {
    id: number;
    amountCents: number;
    stripeRefundId: string | null;
    createdAt: string;
    items: { id: number; orderItemId: number; quantity: number }[];
  }[];
  returnRequests: ReturnRequest[];
}

export type ReturnRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ReturnRequest {
  id: number;
  orderId: number;
  status: ReturnRequestStatus;
  reason: string;
  loggedByName: string;
  createdAt: string;
  resolvedByName: string | null;
  resolvedAt: string | null;
  reviewNote: string | null;
  refundRecordId: number | null;
  items: { id: number; orderItemId: number; quantity: number }[];
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

export type PaymentSortField = "createdAt" | "totalCents" | "paymentAttemptCount";

export interface PaymentsPage {
  payments: Payment[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
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

export interface OrderStatistics {
  totalOrders: number;
  totalRevenueCents: number;
  avgOrderValueCents: number;
  newClientCount: number;
  countsByStatus: { status: OrderStatus; count: number }[];
}

export async function fetchInvoiceUrl(orderId: number): Promise<string> {
  const res = await fetch(`${API_URL}/api/orders/${orderId}/invoice`, {
    credentials: "include",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, "Failed to generate invoice");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function fetchOrderStatistics(): Promise<OrderStatistics> {
  return apiFetch("/api/orders/statistics");
}

export interface TopProduct {
  productId: number;
  title: string;
  unitsSold: number;
  revenueCents: number;
}

export async function fetchTopProducts(limit = 5): Promise<TopProduct[]> {
  const data = await apiFetch(`/api/orders/top-products?limit=${limit}`);
  return data.products;
}

export interface HeldOrder {
  id: number;
  reference: string;
  user: { id: number; email: string } | null;
  totalCents: number;
  refundedCents: number;
  remainingCents: number;
  currency: string;
  items: { id: number; productTitle: string; sku: string; quantity: number }[];
}

// Orders sitting in PARTIALLY_REFUNDED — money already moved back to the
// customer for part of the order, but the order itself isn't fully
// resolved. See order.service.ts's listHeldOrders.
export async function fetchHeldOrders(): Promise<HeldOrder[]> {
  const data = await apiFetch("/api/orders/held");
  return data.orders;
}

export interface OrdersPage {
  orders: Order[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function fetchOrders(
  params: {
    search?: string;
    status?: OrderStatus;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
  } = {}
): Promise<OrdersPage> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);
  if (params.page) query.set("page", String(params.page));
  const qs = query.toString();
  return apiFetch(`/api/orders${qs ? `?${qs}` : ""}`);
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

export async function createCategory(name: string): Promise<Category> {
  const data = await apiFetch("/api/v1/products/admin/categories", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return data.category;
}

export async function updateCategory(id: number, name: string): Promise<Category> {
  const data = await apiFetch(`/api/v1/products/admin/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  return data.category;
}

export async function deleteCategory(id: number): Promise<void> {
  await apiFetch(`/api/v1/products/admin/categories/${id}`, { method: "DELETE" });
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

export async function exportProductsXlsxUrl(): Promise<string> {
  const res = await fetch(`${API_URL}/api/v1/products/admin/export`, {
    credentials: "include",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, "Failed to export catalog");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export interface XlsxImportResult {
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  errors: string[];
}

export async function importProductsXlsx(file: File): Promise<XlsxImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch("/api/v1/products/admin/import", { method: "POST", body: formData });
}

// Exports whatever the Orders list is currently filtered to (search/status/
// date range) — omit all params for the full unfiltered export.
export async function exportOrdersCsvUrl(
  params: { search?: string; status?: OrderStatus; dateFrom?: string; dateTo?: string } = {}
): Promise<string> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);
  const qs = query.toString();
  const res = await fetch(`${API_URL}/api/orders/export${qs ? `?${qs}` : ""}`, {
    credentials: "include",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, "Failed to export orders");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
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

export async function addOrderNote(id: number, body: string): Promise<OrderDetail> {
  const data = await apiFetch(`/api/orders/${id}/notes`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  return data.order;
}

export async function logReturnRequest(
  orderId: number,
  reason: string,
  items: { orderItemId: number; quantity: number }[]
): Promise<OrderDetail> {
  const data = await apiFetch(`/api/orders/${orderId}/return-requests`, {
    method: "POST",
    body: JSON.stringify({ reason, items }),
  });
  return data.order;
}

export async function approveReturnRequest(
  requestId: number,
  options?: { amountCents?: number; reviewNote?: string }
): Promise<OrderDetail> {
  const data = await apiFetch(`/api/orders/return-requests/${requestId}/approve`, {
    method: "POST",
    body: JSON.stringify(options ?? {}),
  });
  return data.order;
}

export async function rejectReturnRequest(requestId: number, reviewNote?: string): Promise<OrderDetail> {
  const data = await apiFetch(`/api/orders/return-requests/${requestId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reviewNote }),
  });
  return data.order;
}

export async function fetchCustomers(
  page = 1,
  search?: string,
  hasCartItems?: boolean,
  hasFeedback?: boolean
): Promise<CustomersPage> {
  const query = new URLSearchParams({ page: String(page) });
  if (search) query.set("search", search);
  if (hasCartItems) query.set("hasCartItems", "true");
  if (hasFeedback) query.set("hasFeedback", "true");
  return apiFetch(`/api/v1/customers?${query.toString()}`);
}

export async function fetchCustomer(id: number): Promise<CustomerDetail> {
  const data = await apiFetch(`/api/v1/customers/${id}`);
  return data.customer;
}

export async function fetchShipments(
  tab: ShipmentTab,
  params: {
    search?: string;
    carrier?: string[];
    country?: string[];
    dateFrom?: string;
    dateTo?: string;
    sortBy?: ShipmentSortField;
    sortDir?: SortDir;
    page?: number;
  } = {}
): Promise<ShipmentsPage> {
  const query = new URLSearchParams({ tab });
  if (params.search) query.set("search", params.search);
  for (const c of params.carrier ?? []) query.append("carrier", c);
  for (const c of params.country ?? []) query.append("country", c);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.sortDir) query.set("sortDir", params.sortDir);
  if (params.page) query.set("page", String(params.page));
  return apiFetch(`/api/v1/shipping?${query.toString()}`);
}

// Exports whatever the given Deliveries tab is currently filtered to
// (search/carrier/country/date range) — omit filter params for the full
// unfiltered export of that tab.
export async function exportShipmentsCsvUrl(
  tab: ShipmentTab,
  params: { search?: string; carrier?: string[]; country?: string[]; dateFrom?: string; dateTo?: string } = {}
): Promise<string> {
  const query = new URLSearchParams({ tab });
  if (params.search) query.set("search", params.search);
  for (const c of params.carrier ?? []) query.append("carrier", c);
  for (const c of params.country ?? []) query.append("country", c);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);
  const res = await fetch(`${API_URL}/api/v1/shipping/export?${query.toString()}`, {
    credentials: "include",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, "Failed to export deliveries");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function fetchShipmentStatistics(): Promise<ShipmentStatistics> {
  return apiFetch("/api/v1/shipping/statistics");
}

export async function shipOrder(orderId: number, trackingNumber: string, carrier?: string): Promise<Order> {
  const data = await apiFetch(`/api/v1/shipping/${orderId}/ship`, {
    method: "PATCH",
    body: JSON.stringify({ trackingNumber, carrier }),
  });
  return data.order;
}

export async function fetchCarrierRules(): Promise<CarrierRule[]> {
  const data = await apiFetch("/api/v1/carrier-rules");
  return data.rules;
}

export async function upsertCarrierRule(country: string, carrier: string): Promise<CarrierRule> {
  const data = await apiFetch("/api/v1/carrier-rules", {
    method: "POST",
    body: JSON.stringify({ country, carrier }),
  });
  return data.rule;
}

export async function deleteCarrierRule(id: number): Promise<void> {
  await apiFetch(`/api/v1/carrier-rules/${id}`, { method: "DELETE" });
}

export async function fetchPaymentMethodRules(): Promise<PaymentMethodRule[]> {
  const data = await apiFetch("/api/v1/payment-method-rules");
  return data.rules;
}

// Replaces the full allowed-method set for a country — pass an empty array
// to clear the rule (back to "every method accepted" for that country).
export async function setPaymentMethodRules(country: string, methods: PaymentMethod[]): Promise<PaymentMethodRule[]> {
  const data = await apiFetch(`/api/v1/payment-method-rules/${country}`, {
    method: "PUT",
    body: JSON.stringify({ methods }),
  });
  return data.rules;
}

export interface StaffUser {
  id: number;
  username: string;
  name: string;
  role: AdminRole;
  createdAt: string;
}

export async function fetchStaff(): Promise<StaffUser[]> {
  const data = await apiFetch("/api/v1/staff");
  return data.users;
}

export async function createStaff(input: { username: string; password: string; name: string; role: AdminRole }): Promise<StaffUser> {
  const data = await apiFetch("/api/v1/staff", { method: "POST", body: JSON.stringify(input) });
  return data.user;
}

export async function updateStaff(id: number, input: { name?: string; role?: AdminRole; password?: string }): Promise<StaffUser> {
  const data = await apiFetch(`/api/v1/staff/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  return data.user;
}

export async function deleteStaff(id: number): Promise<void> {
  await apiFetch(`/api/v1/staff/${id}`, { method: "DELETE" });
}

export interface TaxRule {
  id: number;
  country: string;
  ratePercent: string;
}

export async function fetchTaxRules(): Promise<TaxRule[]> {
  const data = await apiFetch("/api/v1/tax-rules");
  return data.rules;
}

export async function upsertTaxRule(country: string, ratePercent: number): Promise<TaxRule> {
  const data = await apiFetch("/api/v1/tax-rules", {
    method: "POST",
    body: JSON.stringify({ country, ratePercent }),
  });
  return data.rule;
}

export async function deleteTaxRule(id: number): Promise<void> {
  await apiFetch(`/api/v1/tax-rules/${id}`, { method: "DELETE" });
}

export async function fetchCoupons(): Promise<Coupon[]> {
  const data = await apiFetch("/api/v1/coupons");
  return data.coupons;
}

export async function createCoupon(input: CouponInput): Promise<Coupon> {
  const data = await apiFetch("/api/v1/coupons", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.coupon;
}

export async function updateCoupon(id: number, input: Partial<CouponInput> & { isActive?: boolean }): Promise<Coupon> {
  const data = await apiFetch(`/api/v1/coupons/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return data.coupon;
}

export async function deleteCoupon(id: number): Promise<void> {
  await apiFetch(`/api/v1/coupons/${id}`, { method: "DELETE" });
}

export async function fetchPayments(
  params: {
    search?: string;
    paymentMethod?: PaymentMethod[];
    status?: OrderStatus[];
    dateFrom?: string;
    dateTo?: string;
    sortBy?: PaymentSortField;
    sortDir?: SortDir;
    page?: number;
  } = {}
): Promise<PaymentsPage> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  for (const method of params.paymentMethod ?? []) query.append("paymentMethod", method);
  for (const status of params.status ?? []) query.append("status", status);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.sortDir) query.set("sortDir", params.sortDir);
  if (params.page) query.set("page", String(params.page));
  const qs = query.toString();
  return apiFetch(`/api/v1/payments${qs ? `?${qs}` : ""}`);
}

// Exports whatever the Payments list is currently filtered to (search/
// method/status/date range) — omit all params for the full unfiltered
// export.
export async function exportPaymentsCsvUrl(
  params: {
    search?: string;
    paymentMethod?: PaymentMethod[];
    status?: OrderStatus[];
    dateFrom?: string;
    dateTo?: string;
  } = {}
): Promise<string> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  for (const method of params.paymentMethod ?? []) query.append("paymentMethod", method);
  for (const status of params.status ?? []) query.append("status", status);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);
  const qs = query.toString();
  const res = await fetch(`${API_URL}/api/v1/payments/export${qs ? `?${qs}` : ""}`, {
    credentials: "include",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, "Failed to export payments");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// The endpoint always returns the full OrderDetail shape (via getOrderById
// server-side) — typed as such so callers that need the detail fields
// (RefundPanel) don't need an unsafe cast; callers that only read summary
// fields like `status` (Payments/Orders list pages) still work fine since
// OrderDetail is a superset of Order.
export async function refundPayment(
  orderId: number,
  options?: { amountCents?: number; items?: { orderItemId: number; quantity: number }[] }
): Promise<OrderDetail> {
  const data = await apiFetch("/api/v1/payments/refund", {
    method: "POST",
    body: JSON.stringify({ orderId, ...options }),
  });
  return data.order;
}

export type ApiEnvironment = "SANDBOX" | "PRODUCTION";

export interface StoreSettings {
  storeName: string;
  logoUrl: string | null;
  allowPartialRefunds: boolean;
  defaultCarrier: string;
  // Which credential pair below is actually used to build the
  // Stripe/EasyPost clients — see lib/credentials.ts on the server.
  apiEnvironment: ApiEnvironment;
  // Whether each credential is configured (DB, or .env for the Test ones
  // only) — the real secret value never travels to the browser, see
  // settings.service.ts's getStoreSettings.
  stripeSecretKeyTestSet: boolean;
  stripeWebhookSecretTestSet: boolean;
  easypostApiKeyTestSet: boolean;
  stripeSecretKeyLiveSet: boolean;
  stripeWebhookSecretLiveSet: boolean;
  easypostApiKeyLiveSet: boolean;
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

export async function setAllowPartialRefunds(allowPartialRefunds: boolean): Promise<StoreSettings> {
  const data = await apiFetch("/api/v1/settings", {
    method: "PATCH",
    body: JSON.stringify({ allowPartialRefunds }),
  });
  return data.settings;
}

export async function setDefaultCarrier(defaultCarrier: string): Promise<StoreSettings> {
  const data = await apiFetch("/api/v1/settings", {
    method: "PATCH",
    body: JSON.stringify({ defaultCarrier }),
  });
  return data.settings;
}

// Any field left blank is left unchanged server-side — see
// settings.service.ts's updateStoreSettings. Pass only the keys actually
// being changed.
export async function setApiCredentials(input: {
  stripeSecretKeyTest?: string;
  stripeWebhookSecretTest?: string;
  easypostApiKeyTest?: string;
  stripeSecretKeyLive?: string;
  stripeWebhookSecretLive?: string;
  easypostApiKeyLive?: string;
}): Promise<StoreSettings> {
  const data = await apiFetch("/api/v1/settings", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return data.settings;
}

// Switching TO production requires the literal confirm phrase — see
// settings.routes.ts, which rejects a PRODUCTION switch without it. This
// makes Stripe charges and EasyPost trackers real, so it's not a plain
// field flip like the other settings here.
export async function setApiEnvironment(environment: ApiEnvironment): Promise<StoreSettings> {
  const data = await apiFetch("/api/v1/settings", {
    method: "PATCH",
    body: JSON.stringify({
      apiEnvironment: environment,
      ...(environment === "PRODUCTION" ? { confirmProduction: "LIVE" } : {}),
    }),
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

// Both reset actions require the caller to pass the literal string "RESET"
// as confirmation — the server re-validates this itself (see
// settingsRouter's resetConfirmSchema) rather than trusting that the UI
// enforced the type-to-confirm step, so this isn't just UI theater.
export async function clearAllData(): Promise<{ message: string }> {
  return apiFetch("/api/v1/settings/reset/clear", {
    method: "POST",
    body: JSON.stringify({ confirm: "RESET" }),
  });
}

export async function resetSeedData(): Promise<{ message: string }> {
  return apiFetch("/api/v1/settings/reset/seed", {
    method: "POST",
    body: JSON.stringify({ confirm: "RESET" }),
  });
}

// ── Inventory ──────────────────────────────────────────────────────────

export interface InventoryRow {
  variantId: number;
  sku: string;
  productId: number;
  productTitle: string;
  categoryName: string | null;
  attributes: Record<string, string> | null;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
}

export interface InventoryPage {
  variants: InventoryRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function fetchInventory(params: {
  search?: string;
  stockFilter?: "low" | "out";
  page?: number;
  sortDir?: "asc" | "desc";
}): Promise<InventoryPage> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.stockFilter) query.set("stockFilter", params.stockFilter);
  if (params.page) query.set("page", String(params.page));
  if (params.sortDir) query.set("sortDir", params.sortDir);
  const qs = query.toString();
  return apiFetch(`/api/v1/inventory/admin${qs ? `?${qs}` : ""}`);
}

export interface InventorySummary {
  totalVariants: number;
  outOfStock: number;
  lowStock: number;
}

export async function fetchInventorySummary(): Promise<InventorySummary> {
  return apiFetch("/api/v1/inventory/admin/summary");
}

export type StockAdjustmentReason = "MANUAL" | "ORDER_SALE" | "ORDER_RETURN" | "REFUND_RESTOCK";

export interface StockAdjustment {
  id: number;
  variantId: number;
  reason: StockAdjustmentReason;
  deltaQuantity: number;
  resultingQuantity: number;
  note: string | null;
  adminName: string | null;
  orderId: number | null;
  orderReference: string | null;
  createdAt: string;
}

export interface StockAdjustmentPage {
  adjustments: StockAdjustment[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function fetchStockAdjustmentHistory(
  variantId: number,
  page?: number
): Promise<StockAdjustmentPage> {
  const qs = page ? `?page=${page}` : "";
  return apiFetch(`/api/v1/inventory/admin/${variantId}/history${qs}`);
}

export async function adjustStock(
  variantId: number,
  stockQuantity: number,
  note: string
): Promise<{ variantId: number; stockQuantity: number; reservedQuantity: number }> {
  const data = await apiFetch(`/api/v1/inventory/admin/${variantId}/adjust`, {
    method: "PATCH",
    body: JSON.stringify({ stockQuantity, note }),
  });
  return data.inventory;
}

// ── Notifications ──────────────────────────────────────────────────────

export type NotificationType = "RETURN_REQUEST_PENDING" | "LOW_STOCK" | "ORDER_STALE" | "QUESTION_PENDING";

export interface AppNotification {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  isRead: boolean;
  resolvedAt: string | null;
  createdAt: string;
}

export interface NotificationsPage {
  notifications: AppNotification[];
  unreadCount: number;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function fetchNotifications(
  params: {
    unreadOnly?: boolean;
    includeResolved?: boolean;
    type?: NotificationType;
    page?: number;
  } = {}
): Promise<NotificationsPage> {
  const query = new URLSearchParams();
  if (params.unreadOnly) query.set("unreadOnly", "true");
  if (params.includeResolved) query.set("includeResolved", "true");
  if (params.type) query.set("type", params.type);
  if (params.page) query.set("page", String(params.page));
  const qs = query.toString();
  return apiFetch(`/api/v1/notifications${qs ? `?${qs}` : ""}`);
}

export async function markNotificationRead(id: number): Promise<void> {
  await apiFetch(`/api/v1/notifications/${id}/read`, { method: "POST" });
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiFetch("/api/v1/notifications/read-all", { method: "POST" });
}

// ── Reviews & Q&A ────────────────────────────────────────────────────────

// Reviews publish immediately — no pending/approve status. Bad-faith
// content is removed after the fact via deleteReview instead (see
// review.service.ts). Only a customer who actually purchased the product
// can be logged as the author (Verified Purchase) — see fetchProductPurchasers.
export interface Review {
  id: number;
  productId: number;
  userId: number | null;
  authorName: string;
  rating: number;
  body: string;
  createdAt: string;
  product?: { id: number; title: string };
}

export interface ReviewsPage {
  reviews: Review[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function fetchReviews(params: { productId?: number; page?: number } = {}): Promise<ReviewsPage> {
  const query = new URLSearchParams();
  if (params.productId) query.set("productId", String(params.productId));
  if (params.page) query.set("page", String(params.page));
  const qs = query.toString();
  return apiFetch(`/api/v1/reviews${qs ? `?${qs}` : ""}`);
}

// Who the "Log review" customer picker should offer — only customers who
// could actually pass the backend's purchase check for this product.
export async function fetchProductPurchasers(productId: number): Promise<{ id: number; email: string }[]> {
  const data = await apiFetch(`/api/v1/reviews/purchasers?productId=${productId}`);
  return data.purchasers;
}

export async function logReview(input: {
  productId: number;
  userId: number;
  rating: number;
  body: string;
}): Promise<Review> {
  const data = await apiFetch("/api/v1/reviews", { method: "POST", body: JSON.stringify(input) });
  return data.review;
}

export async function deleteReview(id: number): Promise<void> {
  await apiFetch(`/api/v1/reviews/${id}`, { method: "DELETE" });
}

export interface ProductQuestion {
  id: number;
  productId: number;
  userId: number | null;
  authorName: string;
  question: string;
  answer: string | null;
  answeredByName: string | null;
  answeredAt: string | null;
  createdAt: string;
  product?: { id: number; title: string };
}

export interface QuestionsPage {
  questions: ProductQuestion[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function fetchQuestions(
  params: { productId?: number; unansweredOnly?: boolean; page?: number } = {}
): Promise<QuestionsPage> {
  const query = new URLSearchParams();
  if (params.productId) query.set("productId", String(params.productId));
  if (params.unansweredOnly) query.set("unansweredOnly", "true");
  if (params.page) query.set("page", String(params.page));
  const qs = query.toString();
  return apiFetch(`/api/v1/questions${qs ? `?${qs}` : ""}`);
}

export async function logQuestion(input: {
  productId: number;
  userId?: number;
  authorName?: string;
  question: string;
}): Promise<ProductQuestion> {
  const data = await apiFetch("/api/v1/questions", { method: "POST", body: JSON.stringify(input) });
  return data.question;
}

export async function answerQuestion(id: number, answer: string): Promise<ProductQuestion> {
  const data = await apiFetch(`/api/v1/questions/${id}/answer`, {
    method: "POST",
    body: JSON.stringify({ answer }),
  });
  return data.question;
}
