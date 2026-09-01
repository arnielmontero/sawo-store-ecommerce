"use client";

import { useEffect, useState } from "react";
import {
  answerQuestion,
  deleteReview,
  fetchProductPurchasers,
  fetchQuestions,
  fetchReviews,
  logQuestion,
  logReview,
  type ProductQuestion,
  type Review,
} from "@/lib/api";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-500" title={`${rating}/5`}>
      {"★".repeat(rating)}
      <span className="text-ink-300">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export function ReviewsAndQnaPanel({ productId, canModerate }: { productId: number; canModerate: boolean }) {
  const [tab, setTab] = useState<"reviews" | "qna">("reviews");

  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [purchasers, setPurchasers] = useState<{ id: number; email: string }[] | null>(null);
  const [reviewUserId, setReviewUserId] = useState<number | "">("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");
  const [loggingReview, setLoggingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const [questions, setQuestions] = useState<ProductQuestion[] | null>(null);
  const [questionFormOpen, setQuestionFormOpen] = useState(false);
  const [questionAuthor, setQuestionAuthor] = useState("");
  const [questionBody, setQuestionBody] = useState("");
  const [loggingQuestion, setLoggingQuestion] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [answerDrafts, setAnswerDrafts] = useState<Record<number, string>>({});
  const [answeringId, setAnsweringId] = useState<number | null>(null);

  function loadReviews() {
    fetchReviews({ productId }).then((r) => setReviews(r.reviews));
  }
  function loadQuestions() {
    fetchQuestions({ productId }).then((r) => setQuestions(r.questions));
  }

  useEffect(() => {
    loadReviews();
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  function openReviewForm() {
    setReviewFormOpen(true);
    setPurchasers(null);
    fetchProductPurchasers(productId).then(setPurchasers);
  }

  async function handleLogReview() {
    if (!reviewUserId || !reviewBody.trim()) return;
    setLoggingReview(true);
    setReviewError(null);
    try {
      await logReview({ productId, userId: reviewUserId, rating: reviewRating, body: reviewBody.trim() });
      loadReviews();
      setReviewFormOpen(false);
      setReviewUserId("");
      setReviewRating(5);
      setReviewBody("");
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Failed to log review.");
    } finally {
      setLoggingReview(false);
    }
  }

  async function handleDeleteReview(id: number) {
    setDeletingId(id);
    try {
      await deleteReview(id);
      loadReviews();
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleLogQuestion() {
    if (!questionAuthor.trim() || !questionBody.trim()) return;
    setLoggingQuestion(true);
    setQuestionError(null);
    try {
      await logQuestion({ productId, authorName: questionAuthor.trim(), question: questionBody.trim() });
      loadQuestions();
      setQuestionFormOpen(false);
      setQuestionAuthor("");
      setQuestionBody("");
    } catch (err) {
      setQuestionError(err instanceof Error ? err.message : "Failed to log question.");
    } finally {
      setLoggingQuestion(false);
    }
  }

  async function handleAnswer(id: number) {
    const answer = answerDrafts[id];
    if (!answer?.trim()) return;
    setAnsweringId(id);
    try {
      await answerQuestion(id, answer.trim());
      loadQuestions();
      setAnswerDrafts((prev) => ({ ...prev, [id]: "" }));
    } finally {
      setAnsweringId(null);
    }
  }

  const unansweredCount = questions?.filter((q) => !q.answeredAt).length ?? 0;

  return (
    <div className="mt-6 rounded-xl border border-ink-100 bg-white">
      <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTab("reviews")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === "reviews" ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:bg-gray-50"
            }`}
          >
            Reviews{reviews && reviews.length > 0 && ` (${reviews.length})`}
          </button>
          <button
            onClick={() => setTab("qna")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === "qna" ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:bg-gray-50"
            }`}
          >
            Q&amp;A{unansweredCount > 0 && ` (${unansweredCount} unanswered)`}
          </button>
        </div>
        {tab === "reviews" && !reviewFormOpen && (
          <button
            onClick={openReviewForm}
            className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50"
          >
            Log review
          </button>
        )}
        {tab === "qna" && !questionFormOpen && (
          <button
            onClick={() => setQuestionFormOpen(true)}
            className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50"
          >
            Log question
          </button>
        )}
      </div>

      {tab === "reviews" && (
        <>
          {reviewFormOpen && (
            <div className="border-b border-ink-100 px-5 py-4">
              <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">Customer</label>
              <p className="mt-1 text-xs text-ink-400">Only customers who purchased this product can be logged as the reviewer (Verified Purchase).</p>
              {!purchasers ? (
                <p className="mt-2 text-sm text-ink-500">Loading eligible customers...</p>
              ) : purchasers.length === 0 ? (
                <p className="mt-2 text-sm text-ink-500">No customer has purchased this product yet, so a review can't be logged.</p>
              ) : (
                <select
                  value={reviewUserId}
                  onChange={(e) => setReviewUserId(e.target.value ? Number(e.target.value) : "")}
                  className="mt-2 w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Select a customer...</option>
                  {purchasers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.email}
                    </option>
                  ))}
                </select>
              )}
              <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-ink-500">Rating</label>
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setReviewRating(n)}
                    className={`h-8 w-8 rounded-md border text-sm font-medium ${
                      n <= reviewRating ? "border-amber-300 bg-amber-50 text-amber-700" : "border-ink-100 text-ink-400"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-ink-500">Review</label>
              <textarea
                value={reviewBody}
                onChange={(e) => setReviewBody(e.target.value.slice(0, 4000))}
                rows={2}
                placeholder="What the customer said..."
                className="mt-2 w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
              {reviewError && <p className="mt-2 text-sm text-brand-600">{reviewError}</p>}
              <div className="mt-3 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setReviewFormOpen(false);
                    setReviewError(null);
                  }}
                  disabled={loggingReview}
                  className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogReview}
                  disabled={loggingReview || !reviewUserId || !reviewBody.trim()}
                  className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  {loggingReview ? "Logging..." : "Log review"}
                </button>
              </div>
            </div>
          )}

          <div className="px-5 py-4">
            {!reviews ? (
              <p className="text-sm text-ink-500">Loading...</p>
            ) : reviews.length === 0 ? (
              <p className="text-sm text-ink-500">No reviews for this product yet.</p>
            ) : (
              <ul className="space-y-4">
                {reviews.map((review) => (
                  <li key={review.id} className="rounded-lg border border-ink-100 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Stars rating={review.rating} />
                      <span className="text-xs text-ink-500">
                        {review.authorName} · {formatDateTime(review.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-ink-900">{review.body}</p>
                    {canModerate && (
                      <div className="mt-3 flex justify-end border-t border-ink-100 pt-3">
                        {confirmDeleteId === review.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-ink-500">Delete this review?</span>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              disabled={deletingId === review.id}
                              className="rounded-md border border-ink-100 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDeleteReview(review.id)}
                              disabled={deletingId === review.id}
                              className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                            >
                              {deletingId === review.id ? "Deleting..." : "Confirm delete"}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(review.id)}
                            className="rounded-md border border-ink-100 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-gray-50"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {tab === "qna" && (
        <>
          {questionFormOpen && (
            <div className="border-b border-ink-100 px-5 py-4">
              <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">Customer name</label>
              <input
                value={questionAuthor}
                onChange={(e) => setQuestionAuthor(e.target.value)}
                placeholder="Who's asking..."
                className="mt-2 w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
              <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-ink-500">Question</label>
              <textarea
                value={questionBody}
                onChange={(e) => setQuestionBody(e.target.value.slice(0, 2000))}
                rows={2}
                placeholder="What the customer asked..."
                className="mt-2 w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
              {questionError && <p className="mt-2 text-sm text-brand-600">{questionError}</p>}
              <div className="mt-3 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setQuestionFormOpen(false);
                    setQuestionError(null);
                  }}
                  disabled={loggingQuestion}
                  className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogQuestion}
                  disabled={loggingQuestion || !questionAuthor.trim() || !questionBody.trim()}
                  className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  {loggingQuestion ? "Logging..." : "Log question"}
                </button>
              </div>
            </div>
          )}

          <div className="px-5 py-4">
            {!questions ? (
              <p className="text-sm text-ink-500">Loading...</p>
            ) : questions.length === 0 ? (
              <p className="text-sm text-ink-500">No questions for this product yet.</p>
            ) : (
              <ul className="space-y-4">
                {questions.map((q) => (
                  <li key={q.id} className="rounded-lg border border-ink-100 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          q.answeredAt ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {q.answeredAt ? "Answered" : "Unanswered"}
                      </span>
                      <span className="text-xs text-ink-500">
                        {q.authorName} · {formatDateTime(q.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-ink-900">{q.question}</p>
                    {q.answer ? (
                      <p className="mt-2 rounded-md bg-gray-50 p-2 text-sm text-ink-700">
                        <span className="font-medium">{q.answeredByName}: </span>
                        {q.answer}
                        {q.answeredAt && <span className="ml-1 text-xs text-ink-400">· {formatDateTime(q.answeredAt)}</span>}
                      </p>
                    ) : (
                      canModerate && (
                        <div className="mt-3 border-t border-ink-100 pt-3">
                          <textarea
                            value={answerDrafts[q.id] ?? ""}
                            onChange={(e) => setAnswerDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))}
                            rows={2}
                            placeholder="Write a public answer..."
                            className="w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                          />
                          <div className="mt-2 flex justify-end">
                            <button
                              onClick={() => handleAnswer(q.id)}
                              disabled={answeringId === q.id || !answerDrafts[q.id]?.trim()}
                              className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                            >
                              {answeringId === q.id ? "Working..." : "Post answer"}
                            </button>
                          </div>
                        </div>
                      )
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
