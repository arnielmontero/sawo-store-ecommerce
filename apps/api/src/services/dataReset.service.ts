import { prisma } from "../lib/prisma";
import { runSeed } from "../lib/seedData";

// Wipes every table that holds customer-facing / transactional data, while
// deliberately leaving admin accounts (AdminUser/AdminRefreshToken) and
// StoreSettings alone — this is meant to reset "the store's data," not log
// out the admin using the button or blow away Configuration.
//
// Deletion order only matters for the handful of relations that are NOT
// onDelete: Cascade in schema.prisma; everything else follows automatically
// once its parent is deleted. Order/Product/Category/Tag/User are the real
// roots — deleting them cascades to OrderItem, OrderStatusHistory,
// RefundRecord, RefundRecordItem, OrderNote, ProductVariant, Inventory,
// ProductImage, and ProductTag.
async function clearStoreData() {
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.user.deleteMany();
  await prisma.processedWebhookEvent.deleteMany();
}

export async function clearAllData() {
  await clearStoreData();
}

export async function resetSeedData(): Promise<string> {
  await clearStoreData();
  return runSeed();
}
