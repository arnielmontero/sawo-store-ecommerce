import { prisma } from "../lib/prisma";
import { getStoreSettings } from "./settings.service";

export async function listCarrierRules() {
  return prisma.carrierRule.findMany({ orderBy: { country: "asc" } });
}

export async function upsertCarrierRule(country: string, carrier: string) {
  return prisma.carrierRule.upsert({
    where: { country },
    update: { carrier },
    create: { country, carrier },
  });
}

export async function deleteCarrierRule(id: number) {
  await prisma.carrierRule.delete({ where: { id } });
}

// Auto-assignment used at checkout — a country with no matching rule falls
// back to StoreSettings.defaultCarrier rather than leaving the order
// unassigned. Staff can still override the result per-order afterward (see
// shipping.service.ts).
export async function assignCarrier(shippingCountry: string | null | undefined) {
  if (shippingCountry) {
    const rule = await prisma.carrierRule.findUnique({ where: { country: shippingCountry } });
    if (rule) return rule.carrier;
  }
  const settings = await getStoreSettings();
  return settings.defaultCarrier;
}
