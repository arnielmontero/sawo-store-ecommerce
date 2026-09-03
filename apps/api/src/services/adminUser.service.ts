import { AdminRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";
import { hashPassword } from "../lib/password";
import { PRESET_GRANTS } from "./permission.service";

interface AdminUserRow {
  id: number;
  username: string;
  name: string;
  role: AdminRole;
  createdAt: Date;
  permissions?: { permission: { module: string; action: string } }[];
}

// Shared projection for everything that returns an admin account — the
// staff list, create/update responses, and the auth routes' session user.
// isSuperAdmin is computed here rather than left to each caller so the
// frontend never has to re-derive "is this the ADMIN role" itself.
export function toPublicAdminUser(user: AdminUserRow) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    isSuperAdmin: user.role === AdminRole.ADMIN,
    permissions: (user.permissions ?? []).map((g) => `${g.permission.module}:${g.permission.action}`),
    createdAt: user.createdAt,
  };
}

const withPermissions = {
  permissions: { select: { permission: { select: { module: true, action: true } } } },
} as const;

export async function listAdminUsers() {
  const users = await prisma.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    include: withPermissions,
  });
  return users.map(toPublicAdminUser);
}

export async function getAdminUserById(id: number) {
  const user = await prisma.adminUser.findUnique({ where: { id }, include: withPermissions });
  return user ? toPublicAdminUser(user) : null;
}

// Turns "module:action" tokens into the Permission rows they name. Unknown
// tokens are dropped rather than erroring — the catalog is seeded data, and
// a stale token from an old client shouldn't fail an otherwise valid save.
async function resolvePermissionIds(tokens: string[]): Promise<number[]> {
  if (tokens.length === 0) return [];
  const pairs = tokens.map((t) => {
    const [module, action] = t.split(":");
    return { module, action };
  });
  const rows = await prisma.permission.findMany({
    where: { OR: pairs.filter((p) => p.module && p.action) },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export interface CreateAdminUserInput {
  username: string;
  password: string;
  name: string;
  role: AdminRole;
  // Full desired grant set as "module:action" tokens. Omitted means "use
  // whatever the chosen role preset grants" — so a caller that just picks a
  // preset doesn't have to expand it client-side.
  permissions?: string[];
}

export async function createAdminUser(input: CreateAdminUserInput) {
  const existing = await prisma.adminUser.findUnique({ where: { username: input.username } });
  if (existing) throw new HttpError(409, "A staff account with this username already exists");

  const passwordHash = await hashPassword(input.password);
  const tokens = input.permissions ?? PRESET_GRANTS[input.role] ?? [];
  const permissionIds = await resolvePermissionIds(tokens);

  const user = await prisma.adminUser.create({
    data: {
      username: input.username,
      passwordHash,
      name: input.name,
      role: input.role,
      permissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
    },
    include: withPermissions,
  });
  return toPublicAdminUser(user);
}

export interface UpdateAdminUserInput {
  name?: string;
  role?: AdminRole;
  password?: string;
  // The FULL desired grant set, not a delta — matches how the checkbox grid
  // works (the UI sends its whole current state on save).
  permissions?: string[];
}

export async function updateAdminUser(id: number, input: UpdateAdminUserInput) {
  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) throw new HttpError(404, "Staff account not found");

  // Demoting the last super-admin would strip the only account that can
  // reach Staff management, with no recovery short of a direct DB edit —
  // the same lockout deleteAdminUser already guards against, reached
  // through a different door.
  if (input.role && input.role !== user.role && user.role === AdminRole.ADMIN) {
    const otherAdmins = await prisma.adminUser.count({
      where: { role: AdminRole.ADMIN, id: { not: id } },
    });
    if (otherAdmins === 0) throw new HttpError(409, "Can't demote the last remaining admin account");
  }

  const passwordHash = input.password ? await hashPassword(input.password) : undefined;
  const permissionIds = input.permissions ? await resolvePermissionIds(input.permissions) : null;

  await prisma.$transaction(async (tx) => {
    await tx.adminUser.update({
      where: { id },
      data: { name: input.name, role: input.role, passwordHash },
    });

    // Replace-in-full rather than diffing: at this row count it's simpler
    // and there's no per-grant audit trail to preserve.
    if (permissionIds) {
      await tx.adminUserPermission.deleteMany({ where: { adminUserId: id } });
      if (permissionIds.length > 0) {
        await tx.adminUserPermission.createMany({
          data: permissionIds.map((permissionId) => ({ adminUserId: id, permissionId })),
        });
      }
    }
  });

  // A password, role, or permission change invalidates standing sessions —
  // the next refresh should re-authenticate against the new state rather
  // than silently continue on a token issued under the old one. The current
  // (short-lived) access token still works until it expires; permission
  // checks themselves already read live from the DB, so this is
  // defense-in-depth rather than the mechanism that makes changes apply.
  if (input.password || input.role || input.permissions) {
    await prisma.adminRefreshToken.updateMany({
      where: { adminUserId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  const updated = await prisma.adminUser.findUnique({ where: { id }, include: withPermissions });
  return toPublicAdminUser(updated!);
}

// No self-deletion, and never delete the last remaining ADMIN — either one
// would let the whole staff roster (or every admin) lock itself out with no
// recovery path short of a direct DB edit.
export async function deleteAdminUser(id: number, requestingUserId: number) {
  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) throw new HttpError(404, "Staff account not found");
  if (id === requestingUserId) throw new HttpError(400, "You can't delete your own account");

  if (user.role === AdminRole.ADMIN) {
    const otherAdmins = await prisma.adminUser.count({ where: { role: AdminRole.ADMIN, id: { not: id } } });
    if (otherAdmins === 0) throw new HttpError(409, "Can't delete the last remaining admin account");
  }

  await prisma.adminUser.delete({ where: { id } });
}
