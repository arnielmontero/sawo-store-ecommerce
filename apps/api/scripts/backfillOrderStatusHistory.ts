// One-off backfill: existing orders (seeded, or created before
// OrderStatusHistory existed) have no status history rows. Insert one entry
// per order at its current status, dated at createdAt — the closest honest
// approximation, since exact per-transition timestamps were never recorded
// for these. Safe to re-run: skips any order that already has history.
import { prisma } from "../src/lib/prisma";

async function main() {
  const orders = await prisma.order.findMany({
    where: { statusHistory: { none: {} } },
    select: { id: true, status: true, createdAt: true },
  });

  for (const order of orders) {
    await prisma.orderStatusHistory.create({
      data: { orderId: order.id, status: order.status, changedAt: order.createdAt },
    });
  }

  console.log(`Backfilled status history for ${orders.length} order(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
