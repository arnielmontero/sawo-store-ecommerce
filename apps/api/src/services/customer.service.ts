import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";

const PAGE_SIZE = 20;

// Orders that actually resulted in a completed sale — a PENDING or
// CANCELLED order shouldn't inflate a customer's spend/purchase totals.
const COMPLETED_STATUSES = ["PAID", "SHIPPED", "DELIVERED"] as const;

export interface ListCustomersFilters {
  search?: string;
  page?: number;
}

export async function listCustomers(filters: ListCustomersFilters = {}) {
  const currentPage = filters.page && filters.page > 0 ? filters.page : 1;
  // Search matches email or name — the only two identifying free-text
  // fields a customer has (see schema.prisma's User model).
  const where = filters.search
    ? {
        OR: [
          { email: { contains: filters.search } },
          { name: { contains: filters.search } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        orders: { select: { totalCents: true, status: true } },
        // Staff-logged "still deciding" items, not a real live cart (see
        // schema.prisma's CartLead) — summed here so the list can show
        // "how many units are sitting on hold" without a separate request
        // per row.
        cartLeads: { select: { items: { select: { quantity: true } } } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const customers = users.map((user) => {
    const completedOrders = user.orders.filter((o) => (COMPLETED_STATUSES as readonly string[]).includes(o.status));
    const cartItemCount = user.cartLeads.reduce(
      (sum, lead) => sum + lead.items.reduce((leadSum, item) => leadSum + item.quantity, 0),
      0
    );
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      orderCount: user.orders.length,
      totalSpentCents: completedOrders.reduce((sum, o) => sum + o.totalCents, 0),
      cartItemCount,
    };
  });

  return {
    customers,
    pagination: { page: currentPage, pageSize: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) },
  };
}

// Full detail page payload — everything "necessary and important for the
// client" that already exists elsewhere in the system, rolled up in one
// place so staff never have to go hunting order-by-order or product-by-
// product (see review.service.ts, cartLead.service.ts).
export async function getCustomerById(id: number) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: { items: { include: { variant: { include: { product: true } } } }, refunds: true },
      },
      reviews: { orderBy: { createdAt: "desc" }, include: { product: { select: { id: true, title: true } } } },
      questions: { orderBy: { createdAt: "desc" }, include: { product: { select: { id: true, title: true } } } },
      cartLeads: {
        orderBy: { createdAt: "desc" },
        include: { items: { include: { variant: { include: { product: true } } } } },
      },
    },
  });
  if (!user) return null;

  const completedOrders = user.orders.filter((o) => (COMPLETED_STATUSES as readonly string[]).includes(o.status));

  // "Total products purchased" — aggregated across every completed order's
  // items, grouped by product (not variant, so e.g. two sizes of the same
  // heater count as one product line with a combined quantity).
  const purchasesByProduct = new Map<
    number,
    { productId: number; productTitle: string; quantity: number; totalSpentCents: number }
  >();
  for (const order of completedOrders) {
    for (const item of order.items) {
      const productId = item.variant.product.id;
      const existing = purchasesByProduct.get(productId);
      const spent = item.unitPriceCents * item.quantity;
      if (existing) {
        existing.quantity += item.quantity;
        existing.totalSpentCents += spent;
      } else {
        purchasesByProduct.set(productId, {
          productId,
          productTitle: item.variant.product.title,
          quantity: item.quantity,
          totalSpentCents: spent,
        });
      }
    }
  }

  const { passwordHash: _passwordHash, ...publicUser } = user;
  return {
    ...publicUser,
    totalSpentCents: completedOrders.reduce((sum, o) => sum + o.totalCents, 0),
    productsPurchased: Array.from(purchasesByProduct.values()).sort((a, b) => b.quantity - a.quantity),
  };
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

export async function updateCustomerProfile(id: number, input: UpdateCustomerProfileInput) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new HttpError(404, "Customer not found");

  const updated = await prisma.user.update({ where: { id }, data: input });
  const { passwordHash: _passwordHash, ...publicUser } = updated;
  return publicUser;
}
