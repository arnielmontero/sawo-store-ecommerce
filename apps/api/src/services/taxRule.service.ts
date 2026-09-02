import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export async function listTaxRules() {
  return prisma.taxRule.findMany({ orderBy: { country: "asc" } });
}

export async function upsertTaxRule(country: string, ratePercent: number) {
  return prisma.taxRule.upsert({
    where: { country },
    update: { ratePercent: new Prisma.Decimal(ratePercent) },
    create: { country, ratePercent: new Prisma.Decimal(ratePercent) },
  });
}

export async function deleteTaxRule(id: number) {
  await prisma.taxRule.delete({ where: { id } });
}

// A country with no row has no tax — same "absence means no restriction"
// default as isPaymentMethodAllowed, so adding a rule for one country never
// silently starts taxing every other unconfigured country.
export async function getTaxRateForCountry(country: string | null | undefined): Promise<number> {
  if (!country) return 0;
  const rule = await prisma.taxRule.findUnique({ where: { country } });
  return rule ? rule.ratePercent.toNumber() : 0;
}
