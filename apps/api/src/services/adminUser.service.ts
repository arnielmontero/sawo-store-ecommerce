import { AdminRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";
import { hashPassword } from "../lib/password";

function toPublic(user: { id: number; username: string; name: string; role: AdminRole; createdAt: Date }) {
  return { id: user.id, username: user.username, name: user.name, role: user.role, createdAt: user.createdAt };
}

export async function listAdminUsers() {
  const users = await prisma.adminUser.findMany({ orderBy: { createdAt: "asc" } });
  return users.map(toPublic);
}

export interface CreateAdminUserInput {
  username: string;
  password: string;
  name: string;
  role: AdminRole;
}

export async function createAdminUser(input: CreateAdminUserInput) {
  const existing = await prisma.adminUser.findUnique({ where: { username: input.username } });
  if (existing) throw new HttpError(409, "A staff account with this username already exists");

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.adminUser.create({
    data: { username: input.username, passwordHash, name: input.name, role: input.role },
  });
  return toPublic(user);
}

export interface UpdateAdminUserInput {
  name?: string;
  role?: AdminRole;
  password?: string;
}

export async function updateAdminUser(id: number, input: UpdateAdminUserInput) {
  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) throw new HttpError(404, "Staff account not found");

  const passwordHash = input.password ? await hashPassword(input.password) : undefined;
  const updated = await prisma.adminUser.update({
    where: { id },
    data: { name: input.name, role: input.role, passwordHash },
  });

  // A password change or role change invalidates standing sessions — the
  // next refresh attempt should re-authenticate against the new state
  // rather than silently continue on a token issued under the old
  // password/role. The current (short-lived) access token still works
  // until it naturally expires; this only cuts off renewal.
  if (input.password || input.role) {
    await prisma.adminRefreshToken.updateMany({
      where: { adminUserId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  return toPublic(updated);
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
