import { prisma } from "../lib/prisma";

const PAGE_SIZE = 20;

export async function listCustomers(page = 1) {
  const currentPage = page > 0 ? page : 1;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        orders: { select: { totalCents: true, status: true } },
      },
    }),
    prisma.user.count(),
  ]);

  const customers = users.map((user) => {
    // "Spent" only counts orders that actually resulted in a completed sale
    // — a PENDING or CANCELLED order shouldn't inflate a customer's total.
    const completedOrders = user.orders.filter((o) =>
      ["PAID", "SHIPPED", "DELIVERED"].includes(o.status)
    );
    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      orderCount: user.orders.length,
      totalSpentCents: completedOrders.reduce((sum, o) => sum + o.totalCents, 0),
    };
  });

  return {
    customers,
    pagination: { page: currentPage, pageSize: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) },
  };
}

export async function getCustomerById(id: number) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { orders: { orderBy: { createdAt: "desc" }, include: { items: true } } },
  });
  if (!user) return null;

  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}
