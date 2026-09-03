import { Router } from "express";
import { z } from "zod";
import { AdminRole } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/requireAuth";
import { HttpError } from "../middleware/errorHandler";
import { prisma } from "../lib/prisma";
import {
  answerQuestion,
  deleteReview,
  listProductPurchasers,
  listQuestions,
  listReviews,
  logQuestion,
  logReview,
} from "../services/review.service";

export const reviewsRouter = Router();

reviewsRouter.use(requireAuth);

// Same reasoning as ReturnRequest — there's no live customer session in
// this system yet (see checkout()), so staff log what a customer said
// (phone/email/storefront-adjacent channel) rather than a customer writing
// directly. Any staff member can log one; only ADMIN can delete/answer.
//
// Reviews publish immediately (see review.service.ts's logReview) rather
// than sitting behind a pending/approve gate — a pre-publish queue risks
// an admin selectively waving through only good reviews, which is a worse
// trust problem than the one moderation is meant to solve. Bad-faith
// content is removed after the fact via DELETE below instead.

const logReviewSchema = z.object({
  productId: z.number().int().positive(),
  userId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  body: z.string().min(1).max(4000),
});

reviewsRouter.post("/", requireRole(AdminRole.ADMIN, AdminRole.MANAGER, AdminRole.FULFILLMENT_STAFF), async (req, res, next) => {
  try {
    const input = logReviewSchema.parse(req.body);
    const review = await logReview(input);
    res.status(201).json({ review });
  } catch (err) {
    next(err);
  }
});

// Registered before "/:id"-shaped routes so "purchasers" never gets parsed
// as a review id — powers the customer picker on the "Log review" form.
const purchasersQuerySchema = z.object({ productId: z.coerce.number().int().positive() });

reviewsRouter.get("/purchasers", async (req, res, next) => {
  try {
    const { productId } = purchasersQuerySchema.parse(req.query);
    const purchasers = await listProductPurchasers(productId);
    res.json({ purchasers });
  } catch (err) {
    next(err);
  }
});

const listReviewsQuerySchema = z.object({
  productId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().optional(),
});

reviewsRouter.get("/", async (req, res, next) => {
  try {
    const filters = listReviewsQuerySchema.parse(req.query);
    const result = await listReviews(filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

reviewsRouter.delete("/:id", requireRole(AdminRole.ADMIN, AdminRole.MANAGER), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await deleteReview(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ── Q&A — mounted at /api/v1/questions (see index.ts) ─────────────────

export const questionsRouter = Router();

questionsRouter.use(requireAuth);

const logQuestionSchema = z.object({
  productId: z.number().int().positive(),
  userId: z.number().int().positive().optional(),
  authorName: z.string().min(1).max(120).optional(),
  question: z.string().min(1).max(2000),
});

questionsRouter.post("/", requireRole(AdminRole.ADMIN, AdminRole.MANAGER, AdminRole.FULFILLMENT_STAFF), async (req, res, next) => {
  try {
    const input = logQuestionSchema.parse(req.body);
    const question = await logQuestion(input);
    res.status(201).json({ question });
  } catch (err) {
    next(err);
  }
});

const listQuestionsQuerySchema = z.object({
  productId: z.coerce.number().int().positive().optional(),
  unansweredOnly: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
});

questionsRouter.get("/", async (req, res, next) => {
  try {
    const filters = listQuestionsQuerySchema.parse(req.query);
    const result = await listQuestions(filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

const answerQuestionSchema = z.object({ answer: z.string().min(1).max(4000) });

questionsRouter.post("/:id/answer", requireRole(AdminRole.ADMIN, AdminRole.MANAGER), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { answer } = answerQuestionSchema.parse(req.body);
    const admin = await prisma.adminUser.findUnique({ where: { id: req.adminAuth!.userId } });
    if (!admin) throw new HttpError(401, "Unauthorized");
    const question = await answerQuestion(id, answer, admin.name);
    res.json({ question });
  } catch (err) {
    next(err);
  }
});
