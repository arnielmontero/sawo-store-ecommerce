import jwt from "jsonwebtoken";
import { AdminRole } from "@prisma/client";
import { env } from "./env";

const ACCESS_TOKEN_TTL = "15m";

export interface AccessTokenPayload {
  userId: number;
  role: AdminRole;
}

export function createAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (typeof decoded === "string") return null;
    const { userId, role } = decoded as Record<string, unknown>;
    const validRoles: unknown[] = Object.values(AdminRole);
    if (typeof userId !== "number" || !validRoles.includes(role)) {
      return null;
    }
    return { userId, role: role as AdminRole };
  } catch {
    return null;
  }
}
