import type { ProductQA, ProductReview } from "@/lib/api";
import { StarRating } from "./StarRating";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// Breakdown of how many reviews sat at each star level — the standard
// "5 star ▮▮▮▮ 12" histogram every major storefront shows above the review
// list. Computed from the real review rows, never estimated.
function ratingBreakdown(reviews: ProductReview[]) {
  return [5, 4, 3, 2, 1].map((stars) => {
    const count = reviews.filter((review) => review.rating === stars).length;
    return { stars, count, percent: reviews.length > 0 ? (count / reviews.length) * 100 : 0 };
  });
}

export function ProductReviews({
  reviews,
  questions,
  rating,
  reviewCount,
}: {
  reviews: ProductReview[];
  questions: ProductQA[];
  rating: number | null;
  reviewCount: number;
}) {
  // A product with no reviews AND no answered questions gets no section at
  // all rather than an empty "0 reviews" shell.
  if (reviews.length === 0 && questions.length === 0) return null;

  const breakdown = ratingBreakdown(reviews);

  return (
    <div className="border-t border-ink-100 pt-12">
      {reviews.length > 0 && (
        <section aria-labelledby="reviews-heading">
          <h2 id="reviews-heading" className="mb-6 font-serif text-2xl font-semibold text-ink-900">
            Customer Reviews
          </h2>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
            <div className="h-fit rounded-2xl bg-white p-6 shadow-card">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold text-ink-900">{(rating ?? 0).toFixed(1)}</span>
                <span className="text-sm text-ink-500">out of 5</span>
              </div>
              <div className="mt-2">
                <StarRating rating={rating} reviewCount={reviewCount} size="md" />
              </div>
              <p className="mt-2 text-sm text-ink-500">
                Based on {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
              </p>

              <div className="mt-5 flex flex-col gap-1.5">
                {breakdown.map(({ stars, count, percent }) => (
                  <div key={stars} className="flex items-center gap-2 text-xs text-ink-500">
                    <span className="w-8 shrink-0">{stars}★</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream-200">
                      <div className="h-full rounded-full bg-cedar-500" style={{ width: `${percent}%` }} />
                    </div>
                    <span className="w-6 shrink-0 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <ul className="flex flex-col gap-5">
              {reviews.map((review) => (
                <li key={review.id} className="rounded-2xl bg-white p-6 shadow-card">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <StarRating rating={review.rating} reviewCount={1} />
                      <span className="text-sm font-medium text-ink-900">{review.authorName}</span>
                      {/* Every Review row requires a matching PAID/SHIPPED/DELIVERED
                          order before it can be created (review.service.ts), so this
                          badge reflects a real constraint, not a decorative label. */}
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        Verified Purchase
                      </span>
                    </div>
                    <time dateTime={review.createdAt} className="text-xs text-ink-300">
                      {formatDate(review.createdAt)}
                    </time>
                  </div>
                  <p className="mt-3 leading-relaxed text-ink-700">{review.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {questions.length > 0 && (
        <section aria-labelledby="qa-heading" className="mt-14">
          <h2 id="qa-heading" className="mb-6 font-serif text-2xl font-semibold text-ink-900">
            Questions &amp; Answers
          </h2>
          <ul className="flex flex-col gap-4">
            {questions.map((qa) => (
              <li key={qa.id} className="rounded-2xl bg-white p-6 shadow-card">
                <div className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-bold text-white">
                    Q
                  </span>
                  <p className="font-medium text-ink-900">{qa.question}</p>
                </div>
                {qa.answer && (
                  <div className="mt-4 flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cedar-600 text-xs font-bold text-white">
                      A
                    </span>
                    <div>
                      <p className="leading-relaxed text-ink-700">{qa.answer}</p>
                      <p className="mt-2 text-xs text-ink-300">
                        {qa.answeredByName ? `Answered by ${qa.answeredByName}` : "Answered by SAWO"}
                        {qa.answeredAt && ` · ${formatDate(qa.answeredAt)}`}
                      </p>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
