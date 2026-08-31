import type { NextFunction, Request, Response } from "express";
import { AdminRole } from "@prisma/client";
import { verifyAccessToken, type AccessTokenPayload } from "../lib/jwt";
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

export function requireRole(...roles: AdminRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.adminAuth || !roles.includes(req.adminAuth.role)) {
      return next(new HttpError(403, "Forbidden"));
    }
    next();
  };
}
