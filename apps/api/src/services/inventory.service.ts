import { prisma } from "../lib/prisma";

// Atomically reserves stock for one variant. The UPDATE's WHERE clause
// re-checks (stock_quantity - reserved_quantity) >= quantity in the same
// statement the database executes, so two concurrent requests for the last
// unit can't both read "1 available" and both succeed — only one UPDATE's
// WHERE clause will still be true by the time it runs, because MySQL takes
// a row lock for the duration of the UPDATE. The other blocks, then
// re-evaluates the WHERE clause against the now-updated row and fails.
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
// into the available pool.
export async function releaseStock(variantId: number, quantity: number): Promise<void> {
  if (quantity <= 0) return;

  await prisma.$executeRaw`
    UPDATE Inventory
    SET reservedQuantity = GREATEST(reservedQuantity - ${quantity}, 0)
    WHERE variantId = ${variantId}
  `;
}

// Converts a reservation into a permanent deduction on payment success:
// stockQuantity and reservedQuantity both drop by quantity, so the units
// leave the pool entirely rather than becoming available again.
export async function commitReservedStock(variantId: number, quantity: number): Promise<void> {
  if (quantity <= 0) return;

  await prisma.$executeRaw`
    UPDATE Inventory
    SET stockQuantity = GREATEST(stockQuantity - ${quantity}, 0),
        reservedQuantity = GREATEST(reservedQuantity - ${quantity}, 0)
    WHERE variantId = ${variantId}
  `;
}

// Restores previously-committed (deducted) stock — used for a return, where
// the units physically come back and should be sellable again.
export async function restockCommittedStock(variantId: number, quantity: number): Promise<void> {
  if (quantity <= 0) return;

  await prisma.$executeRaw`
    UPDATE Inventory
    SET stockQuantity = stockQuantity + ${quantity}
    WHERE variantId = ${variantId}
  `;
}
