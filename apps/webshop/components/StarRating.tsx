// Renders real review data only — a product with no reviews (rating: null)
// simply doesn't render anything from this component, never a fabricated
// default rating.
export function StarRating({
  rating,
  reviewCount,
  size = "sm",
}: {
  rating: number | null;
  reviewCount: number;
  size?: "sm" | "md";
}) {
  if (rating == null || !reviewCount) return null;

  const starSize = size === "md" ? 16 : 13;
  const textClass = size === "md" ? "text-sm" : "text-xs";

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => {
          const fillPercent = Math.max(0, Math.min(1, rating - i)) * 100;
          return (
            <span key={i} className="relative inline-block" style={{ width: starSize, height: starSize }}>
              <svg width={starSize} height={starSize} viewBox="0 0 20 20" className="absolute inset-0 text-ink-100">
                <path
                  fill="currentColor"
                  d="M10 1.5l2.6 5.6 6.1.6-4.6 4.2 1.3 6.1L10 14.9l-5.4 3.1 1.3-6.1L1.3 7.7l6.1-.6L10 1.5z"
                />
              </svg>
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fillPercent}%` }}>
                <svg width={starSize} height={starSize} viewBox="0 0 20 20" className="text-cedar-500">
                  <path
                    fill="currentColor"
                    d="M10 1.5l2.6 5.6 6.1.6-4.6 4.2 1.3 6.1L10 14.9l-5.4 3.1 1.3-6.1L1.3 7.7l6.1-.6L10 1.5z"
                  />
                </svg>
              </span>
            </span>
          );
        })}
      </div>
      <span className={`${textClass} text-ink-500`}>
        {rating.toFixed(1)} ({reviewCount})
      </span>
    </div>
  );
}
