import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";
import { notifyQuestionPending, resolveQuestionNotification } from "./notification.service";

// ── Reviews ────────────────────────────────────────────────────────────

export interface LogReviewInput {
  productId: number;
  userId: number;
  rating: number;
  body: string;
}

// Only a customer who actually purchased this product can review it (same
// "Verified Purchase" gate every major storefront enforces) — checked here
// against a completed order (PAID/SHIPPED/DELIVERED, matching
// customer.service.ts's "counts as a completed sale" convention) that
// contains this product, rather than trusting a freely-typed name.
const PURCHASED_STATUSES = ["PAID", "SHIPPED", "DELIVERED"] as const;

// Publishes immediately (no pending/approve step) — a pre-publish
// moderation queue risks an admin only ever waving through good reviews
// and quietly sitting on bad ones, which is a worse trust problem than the
// one it's meant to solve. Bad-faith/spam content is handled after the
// fact instead, via deleteReview below.
export async function logReview(input: LogReviewInput) {
  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product) throw new HttpError(404, "Product not found");
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new HttpError(400, "Rating must be an integer from 1 to 5");
  }
  if (!input.body.trim()) throw new HttpError(400, "Review body is required");

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new HttpError(404, "Customer not found");

  const purchase = await prisma.order.findFirst({
    where: {
      userId: input.userId,
      status: { in: [...PURCHASED_STATUSES] },
      items: { some: { variant: { productId: input.productId } } },
    },
    select: { id: true },
  });
  if (!purchase) {
    throw new HttpError(409, "This customer hasn't purchased this product, so a review can't be logged for it.");
  }

  return prisma.review.create({
    data: {
      productId: input.productId,
      userId: input.userId,
      authorName: user.email,
      rating: input.rating,
      body: input.body.trim(),
    },
  });
}

// Powers the customer picker on the "Log review" form — only customers who
// could actually pass logReview's purchase check are worth showing, so
// staff never pick someone the backend will then reject.
export async function listProductPurchasers(productId: number) {
  const orders = await prisma.order.findMany({
    where: {
      status: { in: [...PURCHASED_STATUSES] },
      items: { some: { variant: { productId } } },
    },
    select: { user: { select: { id: true, email: true } } },
    distinct: ["userId"],
  });
  return orders.map((o) => o.user).filter((u): u is { id: number; email: string } => u !== null);
}

// ADMIN-only (see reviews.routes.ts) — the after-the-fact removal path
// that replaces pre-publish approval. Hard delete rather than a REJECTED
// status: once a review is never meant to be shown, there's no reason to
// keep the row around the way ReturnRequest keeps a REJECTED audit trail.
export async function deleteReview(reviewId: number) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw new HttpError(404, "Review not found");
  await prisma.review.delete({ where: { id: reviewId } });
}

export interface ListReviewsFilters {
  productId?: number;
  page?: number;
}

const PAGE_SIZE = 20;

export async function listReviews(filters: ListReviewsFilters) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const where = {
    ...(filters.productId ? { productId: filters.productId } : {}),
  };

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: { product: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.review.count({ where }),
  ]);

  return { reviews, pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) } };
}

// ── Q&A ────────────────────────────────────────────────────────────────

export interface LogQuestionInput {
  productId: number;
  // Optional — asking a question doesn't require a purchase (unlike
  // Review), so this can be logged for a browsing/prospective customer
  // with no User row at all, using just a free-typed name. When logged
  // from a Customer's own page, userId is set and authorName is derived
  // from that customer instead.
  userId?: number;
  authorName?: string;
  question: string;
}

export async function logQuestion(input: LogQuestionInput) {
  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product) throw new HttpError(404, "Product not found");
  if (!input.question.trim()) throw new HttpError(400, "Question is required");

  let authorName = input.authorName?.trim();
  if (input.userId) {
    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) throw new HttpError(404, "Customer not found");
    authorName = user.email;
  }
  if (!authorName) throw new HttpError(400, "Author name is required");

  const question = await prisma.productQuestion.create({
    data: { productId: input.productId, userId: input.userId, authorName, question: input.question.trim() },
  });

  await notifyQuestionPending({ questionId: question.id, productId: product.id, productTitle: product.title, question: question.question });

  return question;
}

export async function answerQuestion(questionId: number, answer: string, answeredByName: string) {
  const question = await prisma.productQuestion.findUnique({ where: { id: questionId } });
  if (!question) throw new HttpError(404, "Question not found");
  if (question.answeredAt) throw new HttpError(409, "Question has already been answered");
  if (!answer.trim()) throw new HttpError(400, "Answer is required");

  const updated = await prisma.productQuestion.update({
    where: { id: question.id },
    data: { answer: answer.trim(), answeredByName, answeredAt: new Date() },
  });
  await resolveQuestionNotification(question.id);
  return updated;
}

export interface ListQuestionsFilters {
  productId?: number;
  unansweredOnly?: boolean;
  page?: number;
}

export async function listQuestions(filters: ListQuestionsFilters) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const where = {
    ...(filters.productId ? { productId: filters.productId } : {}),
    ...(filters.unansweredOnly ? { answeredAt: null } : {}),
  };

  const [questions, total] = await Promise.all([
    prisma.productQuestion.findMany({
      where,
      include: { product: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.productQuestion.count({ where }),
  ]);

  return { questions, pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) } };
}
