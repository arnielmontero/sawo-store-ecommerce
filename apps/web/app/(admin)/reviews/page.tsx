"use client";

import { useEffect, useState } from "react";
import {
  fetchReviews,
  fetchProductPurchasers,
  logReview,
  deleteReview,
  fetchQuestions,
  logQuestion,
  answerQuestion,
  fetchProducts,
  type Review,
  type ProductQuestion,
  type Product,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Tab = "reviews" | "questions";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-500" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(rating)}
      <span className="text-ink-200">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

// Debounced product search shared by both "log new" forms — staff type a
// product name and pick from the matches rather than needing to know the id.
function useProductSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);

  useEffect(() => {
    if (selected || !query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      fetchProducts({ search: query, page: 1 })
        .then((page) => setResults(page.products.slice(0, 8)))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [query, selected]);

  function reset() {
    setQuery("");
    setResults([]);
    setSelected(null);
  }

  return { query, setQuery, results, selected, setSelected, reset };
}

export default function ReviewsPage() {
  const { user } = useAuth();
  const canModerate = user?.role === "ADMIN";

  const [tab, setTab] = useState<Tab>("reviews");

  // ── Reviews ──────────────────────────────────────────────────────────
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [showLogReview, setShowLogReview] = useState(false);
  const reviewProduct = useProductSearch();
  const [purchasers, setPurchasers] = useState<{ id: number; email: string }[]>([]);
  const [purchaserId, setPurchaserId] = useState<number | "">("");
  const [rating, setRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  function loadReviews() {
    setReviewsLoading(true);
    fetchReviews()
      .then((page) => setReviews(page.reviews))
      .catch(() => {})
      .finally(() => setReviewsLoading(false));
  }

  useEffect(loadReviews, []);

  useEffect(() => {
    if (!reviewProduct.selected) {
      setPurchasers([]);
      setPurchaserId("");
      return;
    }
    fetchProductPurchasers(reviewProduct.selected.id)
      .then(setPurchasers)
      .catch(() => setPurchasers([]));
  }, [reviewProduct.selected]);

  async function handleLogReview(e: React.FormEvent) {
    e.preventDefault();
    setReviewError(null);
    if (!reviewProduct.selected || !purchaserId || !reviewBody.trim()) {
      setReviewError("Product, customer, and review text are all required.");
      return;
    }
    setReviewSaving(true);
    try {
      await logReview({ productId: reviewProduct.selected.id, userId: Number(purchaserId), rating, body: reviewBody.trim() });
      loadReviews();
      reviewProduct.reset();
      setReviewBody("");
      setRating(5);
      setShowLogReview(false);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Failed to log review.");
    } finally {
      setReviewSaving(false);
    }
  }

  async function handleDeleteReview(review: Review) {
    if (!confirm(`Delete this review by ${review.authorName}? This can't be undone.`)) return;
    await deleteReview(review.id);
    setReviews((prev) => prev.filter((r) => r.id !== review.id));
  }

  // ── Questions ────────────────────────────────────────────────────────
  const [questions, setQuestions] = useState<ProductQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [showLogQuestion, setShowLogQuestion] = useState(false);
  const questionProduct = useProductSearch();
  const [authorName, setAuthorName] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [questionSaving, setQuestionSaving] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [answerDraft, setAnswerDraft] = useState<Record<number, string>>({});
  const [answering, setAnswering] = useState<number | null>(null);

  function loadQuestions() {
    setQuestionsLoading(true);
    fetchQuestions({ unansweredOnly })
      .then((page) => setQuestions(page.questions))
      .catch(() => {})
      .finally(() => setQuestionsLoading(false));
  }

  useEffect(loadQuestions, [unansweredOnly]);

  async function handleLogQuestion(e: React.FormEvent) {
    e.preventDefault();
    setQuestionError(null);
    if (!questionProduct.selected || !authorName.trim() || !questionText.trim()) {
      setQuestionError("Product, customer name, and question text are all required.");
      return;
    }
    setQuestionSaving(true);
    try {
      await logQuestion({ productId: questionProduct.selected.id, authorName: authorName.trim(), question: questionText.trim() });
      loadQuestions();
      questionProduct.reset();
      setAuthorName("");
      setQuestionText("");
      setShowLogQuestion(false);
    } catch (err) {
      setQuestionError(err instanceof Error ? err.message : "Failed to log question.");
    } finally {
      setQuestionSaving(false);
    }
  }

  async function handleAnswer(question: ProductQuestion) {
    const answer = (answerDraft[question.id] ?? "").trim();
    if (!answer) return;
    setAnswering(question.id);
    try {
      const updated = await answerQuestion(question.id, answer);
      setQuestions((prev) => prev.map((q) => (q.id === question.id ? updated : q)));
      setAnswerDraft((prev) => ({ ...prev, [question.id]: "" }));
    } finally {
      setAnswering(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink-900">Reviews & Q&A</h1>
      </div>
      <p className="mt-1 text-sm text-ink-500">
        Product reviews publish immediately — moderate bad-faith content by deleting it. Questions wait here until staff answer them.
      </p>

      <div className="mt-6 flex gap-1 border-b border-ink-100">
        <button
          onClick={() => setTab("reviews")}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${
            tab === "reviews" ? "border-brand-600 text-brand-600" : "border-transparent text-ink-500 hover:text-ink-900"
          }`}
        >
          Reviews ({reviews.length})
        </button>
        <button
          onClick={() => setTab("questions")}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${
            tab === "questions" ? "border-brand-600 text-brand-600" : "border-transparent text-ink-500 hover:text-ink-900"
          }`}
        >
          Questions ({questions.filter((q) => !q.answeredAt).length} unanswered)
        </button>
      </div>

      {tab === "reviews" && (
        <div className="mt-6 rounded-xl border border-ink-100 bg-white">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
            <p className="text-sm font-medium text-ink-900">All reviews</p>
            {canModerate && (
              <button
                onClick={() => setShowLogReview((v) => !v)}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                {showLogReview ? "Cancel" : "+ Log review"}
              </button>
            )}
          </div>

          {showLogReview && (
            <form onSubmit={handleLogReview} className="border-b border-ink-100 bg-gray-50 px-5 py-4">
              <p className="text-xs text-ink-500">
                Reviews require a verified purchase — only customers who bought this product will appear once selected.
              </p>
              <div className="mt-2 flex flex-wrap items-start gap-2">
                <div className="relative">
                  <label className="block text-xs text-ink-500">Product</label>
                  <input
                    type="text"
                    value={reviewProduct.selected ? reviewProduct.selected.title : reviewProduct.query}
                    onChange={(e) => {
                      reviewProduct.setSelected(null);
                      reviewProduct.setQuery(e.target.value);
                    }}
                    placeholder="Search products..."
                    className="mt-1 w-56 rounded-md border border-ink-100 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                  {reviewProduct.results.length > 0 && (
                    <div className="absolute z-10 mt-1 w-56 rounded-md border border-ink-100 bg-white shadow-md">
                      {reviewProduct.results.map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => reviewProduct.setSelected(p)}
                          className="block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                        >
                          {p.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-ink-500">Customer</label>
                  <select
                    value={purchaserId}
                    onChange={(e) => setPurchaserId(e.target.value ? Number(e.target.value) : "")}
                    disabled={!reviewProduct.selected}
                    className="mt-1 w-52 rounded-md border border-ink-100 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:bg-gray-100"
                  >
                    <option value="">
                      {reviewProduct.selected ? (purchasers.length === 0 ? "No purchasers found" : "Select...") : "Pick a product first"}
                    </option>
                    {purchasers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-ink-500">Rating</label>
                  <select
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="mt-1 rounded-md border border-ink-100 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  >
                    {[5, 4, 3, 2, 1].map((r) => (
                      <option key={r} value={r}>
                        {r} star{r > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <textarea
                value={reviewBody}
                onChange={(e) => setReviewBody(e.target.value)}
                placeholder="Review text..."
                rows={2}
                className="mt-2 w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={reviewSaving}
                  className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {reviewSaving ? "Saving..." : "Log review"}
                </button>
                {reviewError && <p className="text-xs text-red-600">{reviewError}</p>}
              </div>
            </form>
          )}

          {reviewsLoading ? (
            <p className="px-5 py-6 text-sm text-ink-500">Loading...</p>
          ) : reviews.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-400">No reviews yet.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {reviews.map((review) => (
                <li key={review.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <Stars rating={review.rating} />
                        <span className="font-medium text-ink-900">{review.product?.title ?? `Product #${review.productId}`}</span>
                      </div>
                      <p className="mt-1 text-sm text-ink-700">{review.body}</p>
                      <p className="mt-1 text-xs text-ink-400">
                        {review.authorName} · {new Date(review.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {canModerate && (
                      <button
                        onClick={() => handleDeleteReview(review)}
                        className="shrink-0 text-xs font-medium text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "questions" && (
        <div className="mt-6 rounded-xl border border-ink-100 bg-white">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
            <p className="text-sm font-medium text-ink-900">All questions</p>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-xs text-ink-600">
                <input type="checkbox" checked={unansweredOnly} onChange={(e) => setUnansweredOnly(e.target.checked)} />
                Unanswered only
              </label>
              <button
                onClick={() => setShowLogQuestion((v) => !v)}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                {showLogQuestion ? "Cancel" : "+ Log question"}
              </button>
            </div>
          </div>

          {showLogQuestion && (
            <form onSubmit={handleLogQuestion} className="border-b border-ink-100 bg-gray-50 px-5 py-4">
              <div className="flex flex-wrap items-start gap-2">
                <div className="relative">
                  <label className="block text-xs text-ink-500">Product</label>
                  <input
                    type="text"
                    value={questionProduct.selected ? questionProduct.selected.title : questionProduct.query}
                    onChange={(e) => {
                      questionProduct.setSelected(null);
                      questionProduct.setQuery(e.target.value);
                    }}
                    placeholder="Search products..."
                    className="mt-1 w-56 rounded-md border border-ink-100 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                  {questionProduct.results.length > 0 && (
                    <div className="absolute z-10 mt-1 w-56 rounded-md border border-ink-100 bg-white shadow-md">
                      {questionProduct.results.map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => questionProduct.setSelected(p)}
                          className="block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                        >
                          {p.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-ink-500">Customer name</label>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Name"
                    className="mt-1 w-44 rounded-md border border-ink-100 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>
              <textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Question text..."
                rows={2}
                className="mt-2 w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={questionSaving}
                  className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {questionSaving ? "Saving..." : "Log question"}
                </button>
                {questionError && <p className="text-xs text-red-600">{questionError}</p>}
              </div>
            </form>
          )}

          {questionsLoading ? (
            <p className="px-5 py-6 text-sm text-ink-500">Loading...</p>
          ) : questions.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-400">No questions yet.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {questions.map((q) => (
                <li key={q.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-ink-900">{q.product?.title ?? `Product #${q.productId}`}</p>
                  <p className="mt-1 text-sm text-ink-700">{q.question}</p>
                  <p className="mt-1 text-xs text-ink-400">
                    {q.authorName} · {new Date(q.createdAt).toLocaleDateString()}
                  </p>
                  {q.answeredAt ? (
                    <div className="mt-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
                      <p>{q.answer}</p>
                      <p className="mt-1 text-xs text-green-600">
                        Answered by {q.answeredByName} · {new Date(q.answeredAt).toLocaleDateString()}
                      </p>
                    </div>
                  ) : canModerate ? (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={answerDraft[q.id] ?? ""}
                        onChange={(e) => setAnswerDraft((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="Write an answer..."
                        className="min-w-0 flex-1 rounded-md border border-ink-100 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      />
                      <button
                        onClick={() => handleAnswer(q)}
                        disabled={answering === q.id || !(answerDraft[q.id] ?? "").trim()}
                        className="shrink-0 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                      >
                        {answering === q.id ? "Saving..." : "Answer"}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-ink-400">Awaiting an admin's answer.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
