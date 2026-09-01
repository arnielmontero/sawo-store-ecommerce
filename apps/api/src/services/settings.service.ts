import { prisma } from "../lib/prisma";

// Singleton row, always id: 1 — upsert so the first read/write creates it
// on demand instead of needing a separate seed step.
export async function getStoreSettings() {
  return prisma.storeSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

export async function updateStoreSettings(input: {
  storeName?: string;
  logoUrl?: string | null;
  allowPartialRefunds?: boolean;
}) {
  return prisma.storeSettings.upsert({
    where: { id: 1 },
    update: {
      storeName: input.storeName,
      logoUrl: input.logoUrl,
      allowPartialRefunds: input.allowPartialRefunds,
    },
    create: {
      id: 1,
      storeName: input.storeName,
      logoUrl: input.logoUrl,
      allowPartialRefunds: input.allowPartialRefunds,
    },
  });
}
