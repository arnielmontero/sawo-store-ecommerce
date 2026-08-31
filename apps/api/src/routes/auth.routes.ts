import { Router, type Response } from "express";
import { z } from "zod";
import { authenticate } from "../services/auth.service";
import { createAccessToken } from "../lib/jwt";
import { issueRefreshToken, rotateRefreshToken, revokeRefreshToken } from "../lib/refreshToken";
import { loginRateLimiter } from "../middleware/rateLimit";
import { requireAuth } from "../middleware/requireAuth";
import { HttpError } from "../middleware/errorHandler";
import { prisma } from "../lib/prisma";

export const authRouter = Router();

const REFRESH_COOKIE_NAME = "refresh_token";
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: "/api/auth",
  });
}

function toPublicUser(user: { username: string; name: string; role: string }) {
  return { username: user.username, name: user.name, role: user.role };
}

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post("/login", loginRateLimiter, async (req, res, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body);
    const user = await authenticate(username, password);
    if (!user) throw new HttpError(401, "Invalid username or password");

    const accessToken = createAccessToken({ userId: user.id, role: user.role });
    const refreshToken = await issueRefreshToken(user.id);
    setRefreshCookie(res, refreshToken);

    res.json({ accessToken, user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!refreshToken) throw new HttpError(401, "Unauthorized");

    const rotated = await rotateRefreshToken(refreshToken);
    if (!rotated) throw new HttpError(401, "Unauthorized");

    const accessToken = createAccessToken({ userId: rotated.user.id, role: rotated.user.role });
    setRefreshCookie(res, rotated.token);

    res.json({ accessToken, user: toPublicUser(rotated.user) });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (refreshToken) await revokeRefreshToken(refreshToken);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.adminUser.findUnique({ where: { id: req.adminAuth?.userId } });
    if (!user) throw new HttpError(401, "Unauthorized");
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});
