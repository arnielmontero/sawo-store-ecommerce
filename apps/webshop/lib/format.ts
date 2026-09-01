export function formatCents(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

// next/image throws a hard render error for any host not in
// next.config.mjs's remotePatterns (currently just our own API). Cart items
// persist their imageUrl to localStorage at add-to-cart time, so a URL
// captured before a product's photo changed (or before an external host was
// removed from remotePatterns) can still be sitting in an old cart on
// return — this keeps that stale value from crashing the page instead of
// just falling back to no image.
export function isRenderableImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  return url.startsWith(apiUrl);
}
