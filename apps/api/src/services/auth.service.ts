import { prisma } from "../lib/prisma";
import { verifyPassword } from "../lib/password";

export async function authenticate(username: string, password: string) {
  const user = await prisma.adminUser.findUnique({ where: { username } });
  if (!user) return null;

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;

  return user;
}
