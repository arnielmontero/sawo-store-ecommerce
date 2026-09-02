import { NotificationType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { PENDING_STALE_HOURS, PAID_STALE_HOURS, SHIPPED_STALE_DAYS } from "../lib/staleOrderThresholds";

// Creates a notification unless an unresolved one with the same (type,
// dedupeKey) already exists — the actual de-duplication guarantee this
// whole module relies on. Called from the real code paths that cause each
// condition (see the three trigger points below), not from a scheduled
// sweep, except for ORDER_STALE which has no single "moment" it becomes
// true and is instead checked when the inbox is opened (see
// checkForStaleOrders).
async function upsertNotification(input: {
  type: NotificationType;
  dedupeKey: string;
  title: string;
  body: string;
  link: string;
}) {
  const existing = await prisma.notification.findFirst({
    where: { type: input.type, dedupeKey: input.dedupeKey, resolvedAt: null },
  });
  if (existing) return existing;

  return prisma.notification.create({
    data: {
      type: input.type,
      dedupeKey: input.dedupeKey,
      title: input.title,
      body: input.body,
      link: input.link,
    },
  });
}

// Marks every open (unresolved) notification for a given (type, dedupeKey)
// resolved — called once the underlying condition is no longer true (a
// return request reviewed, stock back above threshold, an order that
// progressed past the stale status). Independent of isRead: an admin can
// resolve something without ever having opened the inbox, and the
// notification still shows as read/unread accurately for whoever does.
async function resolveNotifications(type: NotificationType, dedupeKey: string) {
  await prisma.notification.updateMany({
    where: { type, dedupeKey, resolvedAt: null },
    data: { resolvedAt: new Date() },
  });
}

// ── Return requests ────────────────────────────────────────────────────

export async function notifyReturnRequestPending(params: {
  returnRequestId: number;
  orderId: number;
  orderReference: string;
  reason: string;
}) {
  await upsertNotification({
    type: NotificationType.RETURN_REQUEST_PENDING,
    dedupeKey: `return-request-${params.returnRequestId}`,
    title: `Return requested — ${params.orderReference}`,
    body: params.reason,
    link: `/orders/${params.orderId}`,
  });
}

export async function resolveReturnRequestNotification(returnRequestId: number) {
  await resolveNotifications(NotificationType.RETURN_REQUEST_PENDING, `return-request-${returnRequestId}`);
}

// ── Q&A ─────────────────────────────────────────────────────────────────
// (Reviews publish immediately with no pending state — see
// review.service.ts's logReview — so there's no equivalent notification
// for them.)

export async function notifyQuestionPending(params: { questionId: number; productId: number; productTitle: string; question: string }) {
  await upsertNotification({
    type: NotificationType.QUESTION_PENDING,
    dedupeKey: `question-${params.questionId}`,
    title: `New question — ${params.productTitle}`,
    body: params.question,
    link: `/catalog/${params.productId}`,
  });
}

export async function resolveQuestionNotification(questionId: number) {
  await resolveNotifications(NotificationType.QUESTION_PENDING, `question-${questionId}`);
}

// ── Low stock ──────────────────────────────────────────────────────────

// Matches Inventory's own LOW_STOCK_THRESHOLD (see inventory.service.ts) —
// called from every stock-mutating function there right after the write,
// so this fires from real sales/returns/manual adjustments, not just a
// periodic scan.
export async function checkLowStockNotification(
  variantId: number,
  stockQuantity: number,
  lowStockThreshold: number
) {
  const dedupeKey = `variant-${variantId}`;

  if (stockQuantity > lowStockThreshold) {
    // Back above threshold (e.g. a restock) — whatever alert was open no
    // longer applies.
    await resolveNotifications(NotificationType.LOW_STOCK, dedupeKey);
    return;
  }

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { sku: true, product: { select: { title: true } } },
  });
  if (!variant) return;

  const isOut = stockQuantity === 0;
  await upsertNotification({
    type: NotificationType.LOW_STOCK,
    dedupeKey,
    title: `${isOut ? "Out of stock" : "Low stock"} — ${variant.product.title}`,
    body: `${variant.sku} has ${stockQuantity} unit(s) remaining.`,
    link: `/inventory`,
  });
}

// ── Stale orders ───────────────────────────────────────────────────────

// No single moment makes an order "24 hours old" the way a return request
// or a sale is a discrete event — so this runs as a live check when the
// inbox is opened (see notifications.routes.ts) instead of being triggered
// from order.service.ts. Cheap: only ever scans orders already in PENDING,
// PAID, or SHIPPED, which is a small slice of the table.
export async function checkForStaleOrders() {
  const pendingCutoff = new Date(Date.now() - PENDING_STALE_HOURS * 60 * 60 * 1000);
  const paidCutoff = new Date(Date.now() - PAID_STALE_HOURS * 60 * 60 * 1000);
  const shippedCutoff = new Date(Date.now() - SHIPPED_STALE_DAYS * 24 * 60 * 60 * 1000);

  const stalePending = await prisma.order.findMany({
    where: { status: "PENDING", createdAt: { lte: pendingCutoff } },
    select: { id: true, reference: true, createdAt: true },
  });
  const stalePaid = await prisma.order.findMany({
    where: { status: "PAID", paidAt: { lte: paidCutoff } },
    select: { id: true, reference: true, paidAt: true },
  });
  const staleShipped = await prisma.order.findMany({
    where: { status: "SHIPPED", updatedAt: { lte: shippedCutoff } },
    select: { id: true, reference: true, updatedAt: true },
  });

  for (const order of stalePending) {
    await upsertNotification({
      type: NotificationType.ORDER_STALE,
      dedupeKey: `order-${order.id}-pending`,
      title: `Order still unpaid — ${order.reference}`,
      body: `Placed over ${PENDING_STALE_HOURS} hours ago and still hasn't been paid.`,
      link: `/orders/${order.id}`,
    });
  }
  for (const order of stalePaid) {
    await upsertNotification({
      type: NotificationType.ORDER_STALE,
      dedupeKey: `order-${order.id}-paid`,
      title: `Order paid, not yet shipped — ${order.reference}`,
      body: `Paid over ${PAID_STALE_HOURS} hours ago and still hasn't shipped.`,
      link: `/deliveries`,
    });
  }
  for (const order of staleShipped) {
    await upsertNotification({
      type: NotificationType.ORDER_STALE,
      dedupeKey: `order-${order.id}-shipped`,
      title: `Order shipped, not yet delivered — ${order.reference}`,
      body: `Shipped over ${SHIPPED_STALE_DAYS} days ago with no delivery update.`,
      link: `/orders/${order.id}`,
    });
  }
}

// Called wherever an order's status actually changes — resolves any stale
// notification for it once it's no longer sitting in PENDING/PAID/SHIPPED,
// so an order that progressed past a stale stage doesn't keep showing an
// alert for it.
export async function resolveStaleOrderNotifications(orderId: number) {
  await resolveNotifications(NotificationType.ORDER_STALE, `order-${orderId}-pending`);
  await resolveNotifications(NotificationType.ORDER_STALE, `order-${orderId}-paid`);
  await resolveNotifications(NotificationType.ORDER_STALE, `order-${orderId}-shipped`);
}

// ── Reading the inbox ──────────────────────────────────────────────────

const PAGE_SIZE = 20;

export interface ListNotificationsFilters {
  unreadOnly?: boolean;
  // Defaults to false — the bell dropdown and the inbox's default view
  // both only care about currently-open issues. The inbox page's "Show
  // resolved" toggle is what sets this true to browse full history.
  includeResolved?: boolean;
  type?: NotificationType;
  page?: number;
}

export async function listNotifications(filters: ListNotificationsFilters) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const where = {
    ...(filters.includeResolved ? {} : { resolvedAt: null }),
    ...(filters.unreadOnly ? { isRead: false } : {}),
    ...(filters.type ? { type: filters.type } : {}),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { resolvedAt: null, isRead: false } }),
  ]);

  return {
    notifications,
    unreadCount,
    pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) },
  };
}

export async function markNotificationRead(id: number) {
  await prisma.notification.update({ where: { id }, data: { isRead: true } });
}

export async function markAllNotificationsRead() {
  await prisma.notification.updateMany({ where: { resolvedAt: null, isRead: false }, data: { isRead: true } });
}
