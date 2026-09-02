import { CouponType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";

export async function listCoupons() {
  return prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
}

export interface CouponInput {
  code: string;
  type: CouponType;
  value?: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  maxUses?: number | null;
}

export async function createCoupon(input: CouponInput) {
  try {
    return await prisma.coupon.create({
      data: {
        code: input.code.toUpperCase(),
        type: input.type,
        value: input.value ?? null,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        maxUses: input.maxUses ?? null,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new HttpError(409, "A coupon with this code already exists");
    }
    throw err;
  }
}

export async function updateCoupon(id: number, input: Partial<CouponInput> & { isActive?: boolean }) {
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw new HttpError(404, "Coupon not found");

  return prisma.coupon.update({
    where: { id },
    data: {
      type: input.type,
      value: input.value === undefined ? undefined : input.value,
      startsAt: input.startsAt === undefined ? undefined : input.startsAt,
      endsAt: input.endsAt === undefined ? undefined : input.endsAt,
      maxUses: input.maxUses === undefined ? undefined : input.maxUses,
      isActive: input.isActive,
    },
  });
}

// Coupons with real order history (usageCount > 0) are never hard-deleted —
// the FK's onDelete: SetNull would keep past orders legible via their
// couponCode snapshot, but silently losing the Coupon row itself (its type/
// value/window) makes "what exactly was SAVE10" unanswerable later. Staff
// should deactivate those instead; only an unused coupon can be removed.
export async function deleteCoupon(id: number) {
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw new HttpError(404, "Coupon not found");
  if (coupon.usageCount > 0) {
    throw new HttpError(409, "This coupon has been used on real orders — deactivate it instead of deleting");
  }
  await prisma.coupon.delete({ where: { id } });
}
