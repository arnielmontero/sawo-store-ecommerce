import { PaymentMethod } from "@prisma/client";
import { prisma } from "../lib/prisma";

export async function listPaymentMethodRules() {
  return prisma.paymentMethodRule.findMany({ orderBy: [{ country: "asc" }, { paymentMethod: "asc" }] });
}

// Replaces the full allowed-method set for a country in one call — the
// Configuration UI edits a country's checkboxes as a group ("PayPal and
// Card are allowed in DE"), not one method at a time, so this matches that
// mental model instead of forcing the caller to diff add/remove itself.
export async function setPaymentMethodRules(country: string, methods: PaymentMethod[]) {
  await prisma.$transaction([
    prisma.paymentMethodRule.deleteMany({ where: { country } }),
    prisma.paymentMethodRule.createMany({ data: methods.map((paymentMethod) => ({ country, paymentMethod })) }),
  ]);
  return prisma.paymentMethodRule.findMany({ where: { country } });
}

// A country with no rows at all has no restriction — every PaymentMethod is
// accepted. This is the pre-existing behavior (no rules ever existed before
// this feature), kept as the default so adding a rule for one country never
// silently blocks checkout in every other country that hasn't been
// configured yet.
export async function isPaymentMethodAllowed(country: string | null | undefined, method: PaymentMethod) {
  if (!country) return true;
  const rulesForCountry = await prisma.paymentMethodRule.count({ where: { country } });
  if (rulesForCountry === 0) return true;
  const match = await prisma.paymentMethodRule.findUnique({
    where: { country_paymentMethod: { country, paymentMethod: method } },
  });
  return match !== null;
}
