"use client";

import { useState } from "react";
import { generateVariantMatrix, type ProductDetail } from "@/lib/api";

interface OptionDraft {
  name: string;
  values: string;
}

export function VariantMatrixGenerator({
  productId,
  onGenerated,
}: {
  productId: number;
  onGenerated: (product: ProductDetail) => void;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<OptionDraft[]>([{ name: "Size", values: "" }]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateOption(index: number, patch: Partial<OptionDraft>) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  }

  function addOption() {
    setOptions((prev) => [...prev, { name: "", values: "" }]);
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  const parsedOptions = options
    .map((o) => ({
      name: o.name.trim(),
      values: o.values
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    }))
    .filter((o) => o.name && o.values.length > 0);

  const previewCount = parsedOptions.reduce((total, o) => total * o.values.length, 1);

  async function handleGenerate() {
    setError(null);
    if (parsedOptions.length === 0) {
      setError("Add at least one option with a name and comma-separated values.");
      return;
    }
    setGenerating(true);
    try {
      const product = await generateVariantMatrix(productId, parsedOptions);
      onGenerated(product);
      setOpen(false);
      setOptions([{ name: "Size", values: "" }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate variants.");
    } finally {
      setGenerating(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50"
      >
        Generate variants
      </button>
    );
  }

  return (
    <div className="rounded-md border border-ink-100 bg-gray-50 p-4">
      <p className="text-sm font-medium text-ink-900">Generate variant matrix</p>
      <p className="mt-1 text-xs text-ink-500">
        Define option sets (e.g. Size: S, M, L) and every combination will be created as a new
        variant. Combinations that already exist on this product are skipped.
      </p>

      <div className="mt-3 space-y-2">
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={option.name}
              onChange={(e) => updateOption(index, { name: e.target.value })}
              placeholder="Option name (e.g. Size)"
              className="w-40 rounded-md border border-ink-100 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            <input
              value={option.values}
              onChange={(e) => updateOption(index, { values: e.target.value })}
              placeholder="Values, comma separated (e.g. S, M, L)"
              className="flex-1 rounded-md border border-ink-100 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            <button
              onClick={() => removeOption(index)}
              disabled={options.length === 1}
              className="rounded-md p-1.5 text-ink-400 hover:bg-white hover:text-brand-600 disabled:opacity-30"
              aria-label="Remove option"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addOption}
        className="mt-2 text-sm font-medium text-brand-600 hover:underline"
      >
        + Add another option
      </button>

      {error && <p className="mt-3 text-sm text-brand-600">{error}</p>}
      {previewCount > 1 && !error && (
        <p className="mt-3 text-xs text-ink-500">Will attempt to create up to {previewCount} variants.</p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {generating ? "Generating..." : "Generate"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md border border-ink-100 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
