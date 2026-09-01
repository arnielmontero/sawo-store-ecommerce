import { Prisma, StockAdjustmentReason } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";

// Kept in sync with the LOW_STOCK_THRESHOLD constant on the frontend
// (Catalog and Inventory pages) — this is the one place the backend needs
// to know it, for the "low stock" filter/sort to mean the same thing the
// UI's badge already shows.
export const LOW_STOCK_THRESHOLD = 10;

// Atomically reserves stock for one variant. The UPDATE's WHERE clause
// re-checks (stock_quantity - reserved_quantity) >= quantity in the same
// statement the database executes, so two concurrent requests for the last
// unit can't both read "1 available" and both succeed — only one UPDATE's
// WHERE clause will still be true by the time it runs, because MySQL takes
// a row lock for the duration of the UPDATE. The other blocks, then
// re-evaluates the WHERE clause against the now-updated row and fails.
//
// Not logged as a StockAdjustment: this only moves the reserved/available
// split, never stockQuantity itself, so there's nothing for "why is stock
// at N now" history to explain yet — that question only applies once
// commitReservedStock actually deducts the units.
export async function reserveStock(variantId: number, quantity: number): Promise<boolean> {
  if (quantity <= 0) return false;

  const affectedRows = await prisma.$executeRaw`
    UPDATE Inventory
    SET reservedQuantity = reservedQuantity + ${quantity}
    WHERE variantId = ${variantId}
      AND (stockQuantity - reservedQuantity) >= ${quantity}
  `;

  return affectedRows === 1;
}

// Releases a reservation without touching stockQuantity — used when an
// order never completes (payment failed/cancelled), so the units go back
// into the available pool. Not logged for the same reason as reserveStock.
export async function releaseStock(variantId: number, quantity: number): Promise<void> {
  if (quantity <= 0) return;

  await prisma.$executeRaw`
    UPDATE Inventory
    SET reservedQuantity = GREATEST(reservedQuantity - ${quantity}, 0)
    WHERE variantId = ${variantId}
  `;
}

interface OrderAdjustmentContext {
  orderId: number;
  orderReference: string;
}

// Converts a reservation into a permanent deduction on payment success:
// stockQuantity and reservedQuantity both drop by quantity, so the units
// leave the pool entirely rather than becoming available again. Logs an
// ORDER_SALE adjustment — this is the point where stock actually leaves the
// shelf, so it's the first point worth explaining in the history.
export async function commitReservedStock(
  variantId: number,
  quantity: number,
  order: OrderAdjustmentContext
): Promise<void> {
  if (quantity <= 0) return;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE Inventory
      SET stockQuantity = GREATEST(stockQuantity - ${quantity}, 0),
          reservedQuantity = GREATEST(reservedQuantity - ${quantity}, 0)
      WHERE variantId = ${variantId}
    `;
    const inventory = await tx.inventory.findUnique({ where: { variantId } });
    if (!inventory) return;
    await tx.stockAdjustment.create({
      data: {
        variantId,
        reason: StockAdjustmentReason.ORDER_SALE,
        deltaQuantity: -quantity,
        resultingQuantity: inventory.stockQuantity,
        orderId: order.orderId,
        orderReference: order.orderReference,
      },
    });
  });
}

// Restores previously-committed (deducted) stock — used for a return or
// refund, where the units physically come back and should be sellable
// again. reason distinguishes a plain return from a refund-driven restock
// so the history reads correctly either way.
export async function restockCommittedStock(
  variantId: number,
  quantity: number,
  order: OrderAdjustmentContext,
  reason: typeof StockAdjustmentReason.ORDER_RETURN | typeof StockAdjustmentReason.REFUND_RESTOCK
): Promise<void> {
  if (quantity <= 0) return;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE Inventory
      SET stockQuantity = stockQuantity + ${quantity}
      WHERE variantId = ${variantId}
    `;
    const inventory = await tx.inventory.findUnique({ where: { variantId } });
    if (!inventory) return;
    await tx.stockAdjustment.create({
      data: {
        variantId,
        reason,
        deltaQuantity: quantity,
        resultingQuantity: inventory.stockQuantity,
        orderId: order.orderId,
        orderReference: order.orderReference,
      },
    });
  });
}

// A staff member typing a new absolute quantity into the Inventory page —
// unlike the order-driven functions above, this takes the target quantity
// directly (not a delta), since that's what the UI actually collects. note
// defaults for the quick inline stock edit on a product's Catalog page
// (no note field there — that flow predates this history and stays
// lightweight); the dedicated Inventory page's adjustment form always
// collects and passes a real one.
export async function adjustStockManually(
  variantId: number,
  newQuantity: number,
  adminName: string,
  note: string = "Adjusted from Catalog"
): Promise<void> {
  if (newQuantity < 0) throw new HttpError(400, "Stock quantity can't be negative");

  await prisma.$transaction(async (tx) => {
    const inventory = await tx.inventory.findUnique({ where: { variantId } });
    if (!inventory) throw new HttpError(404, "Variant not found");

    const delta = newQuantity - inventory.stockQuantity;
    if (delta === 0) return;

    await tx.inventory.update({ where: { variantId }, data: { stockQuantity: newQuantity } });
    await tx.stockAdjustment.create({
      data: {
        variantId,
        reason: StockAdjustmentReason.MANUAL,
        deltaQuantity: delta,
        resultingQuantity: newQuantity,
        adminName,
        note,
      },
    });
  });
}

const PAGE_SIZE = 20;

export interface ListInventoryFilters {
  search?: string;
  stockFilter?: "low" | "out";
  page?: number;
  sortDir?: "asc" | "desc";
}

// Catalog-wide stock view, one row per variant — the screen Catalog itself
// never had: "what's low across everything" without opening each product.
// Always sorted by stock level (ascending by default) so what needs
// attention surfaces first; sortDir lets the highest-stocked show first
// too, for a "what do we have plenty of" glance.
export async function listInventory(filters: ListInventoryFilters) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const sortDir = filters.sortDir === "desc" ? "desc" : "asc";

  const where: Prisma.ProductVariantWhereInput = {
    ...(filters.search
      ? {
          OR: [
            { sku: { contains: filters.search } },
            { product: { title: { contains: filters.search } } },
          ],
        }
      : {}),
    ...(filters.stockFilter === "out"
      ? { inventory: { stockQuantity: 0 } }
      : filters.stockFilter === "low"
        ? { inventory: { stockQuantity: { gt: 0, lte: LOW_STOCK_THRESHOLD } } }
        : {}),
  };

  const [variants, total] = await Promise.all([
    prisma.productVariant.findMany({
      where,
      include: {
        inventory: true,
        product: { select: { id: true, title: true, category: { select: { name: true } } } },
      },
      orderBy: { inventory: { stockQuantity: sortDir } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.productVariant.count({ where }),
  ]);

  const rows = variants.map((v) => ({
    variantId: v.id,
    sku: v.sku,
    productId: v.product.id,
    productTitle: v.product.title,
    categoryName: v.product.category?.name ?? null,
    attributes: v.attributes,
    stockQuantity: v.inventory?.stockQuantity ?? 0,
    reservedQuantity: v.inventory?.reservedQuantity ?? 0,
    availableQuantity: (v.inventory?.stockQuantity ?? 0) - (v.inventory?.reservedQuantity ?? 0),
    isLowStock: (v.inventory?.stockQuantity ?? 0) > 0 && (v.inventory?.stockQuantity ?? 0) <= LOW_STOCK_THRESHOLD,
    isOutOfStock: (v.inventory?.stockQuantity ?? 0) === 0,
  }));

  return {
    variants: rows,
    pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) },
  };
}

export async function getInventorySummary() {
  const [totalVariants, outOfStock, lowStock] = await Promise.all([
    prisma.productVariant.count(),
    prisma.productVariant.count({ where: { inventory: { stockQuantity: 0 } } }),
    prisma.productVariant.count({
      where: { inventory: { stockQuantity: { gt: 0, lte: LOW_STOCK_THRESHOLD } } },
    }),
  ]);
  return { totalVariants, outOfStock, lowStock };
}

const HISTORY_PAGE_SIZE = 20;

// Full "why is stock at N now" trail for one variant, newest first —
// mixes manual edits and every order-driven change (sale/return/refund).
export async function getStockAdjustmentHistory(variantId: number, page?: number) {
  const currentPage = page && page > 0 ? page : 1;

  const [adjustments, total] = await Promise.all([
    prisma.stockAdjustment.findMany({
      where: { variantId },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * HISTORY_PAGE_SIZE,
      take: HISTORY_PAGE_SIZE,
    }),
    prisma.stockAdjustment.count({ where: { variantId } }),
  ]);

  return {
    adjustments,
    pagination: {
      page: currentPage,
      pageSize: HISTORY_PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE)),
    },
  };
}
