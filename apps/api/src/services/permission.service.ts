import { AdminRole } from "@prisma/client";
import { prisma } from "../lib/prisma";

// The full permission catalog — the single source of truth for both the
// seeder (which writes these into the Permission table) and the admin UI's
// checkbox grid (which renders module = row, action = column).
//
// Actions are view/create/edit/delete wherever a route maps cleanly onto
// CRUD, plus a handful of named actions for routes that genuinely don't
// (refunding money, changing an order's state, adjusting stock, wiping
// data) — those deserve their own checkbox rather than being folded into a
// blanket "edit" that would hand out far more than intended.
export const PERMISSION_CATALOG: { module: string; label: string; actions: string[] }[] = [
  // Orders are never created or deleted from the admin (checkout creates
  // them; nothing deletes them), so this module has no create/delete.
  { module: "orders", label: "Orders", actions: ["view", "edit", "changeStatus", "refund"] },
  { module: "catalog", label: "Catalog (Products & Categories)", actions: ["view", "create", "edit", "delete"] },
  // Inventory rows are created implicitly alongside variants, never directly.
  { module: "inventory", label: "Inventory", actions: ["view", "adjustStock"] },
  { module: "coupons", label: "Coupons", actions: ["view", "create", "edit", "delete"] },
  { module: "customers", label: "Customers", actions: ["view", "edit", "logActivity", "delete"] },
  { module: "reviews", label: "Reviews & Q&A", actions: ["view", "respond", "delete"] },
  // Viewing payments is its own capability; the refund action itself lives
  // under orders.refund because both refund entry points (the payments route
  // and the return-request approval) call the same refundOrder() service —
  // one checkbox, not two to keep in sync.
  { module: "payments", label: "Payments", actions: ["view"] },
  // shipping.routes.ts gates its whole router with one check today, so
  // there's no real view/edit split in the routes to mirror — view (reads)
  // and manage (everything else) matches what actually exists.
  { module: "deliveries", label: "Deliveries", actions: ["view", "manage"] },
  { module: "carrierRules", label: "Carrier Rules", actions: ["view", "create", "delete"] },
  { module: "paymentMethodRules", label: "Payment Method Rules", actions: ["view", "edit"] },
  // Kept separate from the other two rule tables specifically so tax can
  // stay stricter than carrier/payment-method rules, as it is today.
  { module: "taxRules", label: "Tax Rules", actions: ["view", "create", "delete"] },
  // resetData is split out from edit because it's destructive and
  // irreversible in a way a settings PATCH is not.
  { module: "configuration", label: "Configuration", actions: ["view", "edit", "resetData"] },
  // staff.edit is the anti-privilege-escalation gate: it covers managing
  // other accounts AND their permission grants. Granted to nobody but
  // super-admins by default.
  { module: "staff", label: "Staff", actions: ["view", "edit"] },
];

export function allPermissionTokens(): string[] {
  return PERMISSION_CATALOG.flatMap((m) => m.actions.map((a) => `${m.module}:${a}`));
}

// What each role preset pre-fills in the checkbox grid. These are a
// starting point an admin can freely customise per account — they are NOT
// consulted at authorization time (only the resulting per-account grants
// are). The sets below reproduce each role's access as it stood under the
// old requireRole() checks, so migrating an existing account onto its
// matching preset is a no-op in terms of what it can actually do.
export const PRESET_GRANTS: Record<AdminRole, string[]> = {
  // Super-admin: bypasses the grant table entirely at check time, so this
  // list is only what gets pre-filled/displayed, never load-bearing.
  ADMIN: allPermissionTokens(),

  MANAGER: [
    "orders:view",
    "orders:edit",
    "orders:changeStatus",
    "orders:refund",
    "catalog:view",
    "catalog:create",
    "catalog:edit",
    "catalog:delete",
    "inventory:view",
    "inventory:adjustStock",
    "coupons:view",
    "coupons:create",
    "coupons:edit",
    "coupons:delete",
    "customers:view",
    "customers:edit",
    "customers:logActivity",
    "customers:delete",
    "reviews:view",
    "reviews:respond",
    "reviews:delete",
    "payments:view",
    "deliveries:view",
    "deliveries:manage",
    "carrierRules:view",
    "carrierRules:create",
    "carrierRules:delete",
    "paymentMethodRules:view",
    "paymentMethodRules:edit",
    // Deliberately excluded, matching the old MANAGER role exactly:
    // taxRules writes, configuration, and staff.
    "taxRules:view",
    "configuration:view",
  ],

  FULFILLMENT_STAFF: [
    "orders:view",
    "orders:edit",
    "orders:changeStatus",
    "catalog:view",
    "inventory:view",
    "coupons:view",
    "customers:view",
    "customers:logActivity",
    "reviews:view",
    "reviews:respond",
    "payments:view",
    "deliveries:view",
    "deliveries:manage",
  ],
};

export async function listPermissionCatalog() {
  const permissions = await prisma.permission.findMany({
    orderBy: [{ module: "asc" }, { action: "asc" }],
  });
  return { permissions, catalog: PERMISSION_CATALOG, presets: PRESET_GRANTS };
}

// Resolves an account's grants into "module:action" tokens — the shape the
// frontend's hasPermission() helper compares against.
export async function getPermissionTokensForUser(adminUserId: number): Promise<string[]> {
  const grants = await prisma.adminUserPermission.findMany({
    where: { adminUserId },
    select: { permission: { select: { module: true, action: true } } },
  });
  return grants.map((g) => `${g.permission.module}:${g.permission.action}`);
}
