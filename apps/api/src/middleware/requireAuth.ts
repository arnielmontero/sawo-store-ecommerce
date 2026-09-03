import type { NextFunction, Request, Response } from "express";
import { AdminRole } from "@prisma/client";
import { verifyAccessToken, type AccessTokenPayload } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { HttpError } from "./errorHandler";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      adminAuth?: AccessTokenPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  const payload = token ? verifyAccessToken(token) : null;
  if (!payload) {
    return next(new HttpError(401, "Unauthorized"));
  }

  req.adminAuth = payload;
  next();
}

// Authorization gate. Reads the account's CURRENT grants from the database
// rather than anything baked into the JWT, so a permission change takes
// effect on the very next request instead of waiting out the access token's
// 15-minute TTL.
//
// The lookup deliberately lives here rather than in requireAuth, so routes
// that only need authentication (notifications, /auth/me) don't pay for a
// permissions query they never use.
export function requirePermission(module: string, action: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.adminAuth) return next(new HttpError(403, "Forbidden"));

    // Super-admins bypass the grant table entirely — see AdminUser.role in
    // schema.prisma. This is what guarantees an unchecked box can never
    // lock every admin out of Staff management.
    if (req.adminAuth.role === AdminRole.ADMIN) return next();

    try {
      const granted = await prisma.adminUserPermission.findFirst({
        where: { adminUserId: req.adminAuth.userId, permission: { module, action } },
        select: { id: true },
      });
      if (!granted) return next(new HttpError(403, "Forbidden"));
      next();
    } catch (err) {
      next(err);
    }
  };
}
