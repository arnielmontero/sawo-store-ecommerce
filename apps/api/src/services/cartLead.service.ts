import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";

// There's no real add-to-cart flow in this system (see schema.prisma's
// CartLead model comment) — staff log what a customer said they were
// interested in, same "logged on the customer's behalf" pattern as
// ReturnRequest/Review.
export interface LogCartLeadInput {
  userId: number;
  items: { variantId: number; quantity: number }[];
  note?: string;
  loggedByName: string;
}

export async function logCartLead(input: LogCartLeadInput) {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new HttpError(404, "Customer not found");
  if (input.items.length === 0) throw new HttpError(400, "At least one item is required");

  for (const line of input.items) {
    if (line.quantity <= 0) throw new HttpError(400, `Invalid quantity for variant ${line.variantId}`);
    const variant = await prisma.productVariant.findUnique({ where: { id: line.variantId } });
    if (!variant) throw new HttpError(404, `Variant ${line.variantId} not found`);
  }

  return prisma.cartLead.create({
    data: {
      userId: input.userId,
      loggedByName: input.loggedByName,
      note: input.note?.trim() || null,
      items: { create: input.items.map((line) => ({ variantId: line.variantId, quantity: line.quantity })) },
    },
    include: { items: { include: { variant: { include: { product: true } } } } },
  });
}

export async function listCartLeadsForUser(userId: number) {
  return prisma.cartLead.findMany({
    where: { userId },
    include: { items: { include: { variant: { include: { product: true } } } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteCartLead(id: number) {
  const lead = await prisma.cartLead.findUnique({ where: { id } });
  if (!lead) throw new HttpError(404, "Cart lead not found");
  await prisma.cartLead.delete({ where: { id } });
}
