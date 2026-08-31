"use client";

import { useRef, useState } from "react";
import {
  deleteProductImage,
  setFeaturedImage,
  reorderProductImages,
  uploadProductImage,
  type ProductImage,
} from "@/lib/api";

export function ProductImageGallery({
  productId,
  images,
  onChange,
}: {
  productId: number;
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sorted = [...images].sort((a, b) => a.position - b.position);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const image = await uploadProductImage(productId, file);
      onChange([...images, image]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(imageId: number) {
    setError(null);
    try {
      await deleteProductImage(productId, imageId);
      const remaining = images.filter((img) => img.id !== imageId);
      // If the featured image was removed, the backend promotes the next
      // one — reflect that locally so the UI doesn't show zero featured
      // images until the next full reload.
      if (remaining.length > 0 && !remaining.some((img) => img.isFeatured)) {
        remaining.sort((a, b) => a.position - b.position)[0].isFeatured = true;
      }
      onChange(remaining);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete image.");
    }
  }

  async function handleSetFeatured(imageId: number) {
    setError(null);
    try {
      await setFeaturedImage(productId, imageId);
      onChange(images.map((img) => ({ ...img, isFeatured: img.id === imageId })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set featured image.");
    }
  }

  async function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    const reordered = [...sorted];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    setDragIndex(null);

    const withPositions = reordered.map((img, i) => ({ ...img, position: i }));
    onChange(withPositions);
    try {
      await reorderProductImages(
        productId,
        withPositions.map((img) => img.id)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save image order.");
    }
  }

  return (
    <div>
      {error && <p className="mb-3 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-600">{error}</p>}

      <div className="flex flex-wrap gap-3">
        {sorted.map((image, index) => (
          <div
            key={image.id}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(index)}
            className={`group relative h-24 w-24 shrink-0 cursor-move overflow-hidden rounded-md border ${
              image.isFeatured ? "border-brand-500 ring-2 ring-brand-200" : "border-ink-100"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt="" className="h-full w-full object-cover" />
            {image.isFeatured && (
              <span className="absolute left-1 top-1 rounded bg-brand-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                Featured
              </span>
            )}
            <div className="absolute inset-0 flex items-end justify-center gap-1 bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
              {!image.isFeatured && (
                <button
                  onClick={() => handleSetFeatured(image.id)}
                  className="mb-1 rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-ink-900 hover:bg-gray-100"
                >
                  Set featured
                </button>
              )}
              <button
                onClick={() => handleDelete(image.id)}
                className="mb-1 rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-brand-600 hover:bg-gray-100"
              >
                Remove
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-md border border-dashed border-ink-200 text-xs text-ink-500 hover:border-brand-500 hover:text-brand-600 disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "+ Add image"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
      </div>
      {sorted.length > 1 && <p className="mt-2 text-xs text-ink-400">Drag to reorder.</p>}
    </div>
  );
}
