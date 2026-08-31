import { randomBytes, createHmac } from "crypto";
import { prisma } from "./prisma";
import { env } from "./env";

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// The raw token is never stored — only an HMAC of it, so a leaked database
// dump can't be replayed as a valid refresh token.
function hashToken(token: string) {
  return createHmac("sha256", env.REFRESH_TOKEN_SECRET).update(token).digest("hex");
}

export async function issueRefreshToken(adminUserId: number) {
  const token = randomBytes(32).toString("base64url");
  await prisma.adminRefreshToken.create({
    data: {
      tokenHash: hashToken(token),
      adminUserId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  return token;
}

// Verifies the token is real, unrevoked, and unexpired, then rotates it:
// the old one is revoked and a new one issued. Rotation means a stolen
// refresh token only works once before the legitimate user's next refresh
// invalidates it (both sides notice the mismatch).
export async function rotateRefreshToken(token: string) {
  const tokenHash = hashToken(token);
  const record = await prisma.adminRefreshToken.findUnique({
    where: { tokenHash },
    include: { adminUser: true },
  });

  if (!record || record.revokedAt || record.expiresAt < new Date()) return null;

  await prisma.adminRefreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  const newToken = await issueRefreshToken(record.adminUserId);
  return { user: record.adminUser, token: newToken };
}

export async function revokeRefreshToken(token: string) {
  const tokenHash = hashToken(token);
  await prisma.adminRefreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
