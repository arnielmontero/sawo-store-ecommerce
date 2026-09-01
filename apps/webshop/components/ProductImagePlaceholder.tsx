// Shown when a product has no uploaded photo yet (admin hasn't added one to
// Catalog -> product -> Images). A plain "No image" label would look broken
// next to real photography, so this renders a simple on-brand glyph instead
// — same clean white-card look as the reference SAWO catalog, just without a
// stand-in photo that could misrepresent the actual product.
export function ProductImagePlaceholder({ label }: { label?: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-cream-100">
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="text-cedar-300">
        <path
          d="M14 20h28l-3 26a3 3 0 0 1-3 2.6H20a3 3 0 0 1-3-2.6L14 20Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path d="M19 20a9 9 0 0 1 18 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
      {label && <span className="px-4 text-center text-xs font-medium text-cedar-400">{label}</span>}
    </div>
  );
}
