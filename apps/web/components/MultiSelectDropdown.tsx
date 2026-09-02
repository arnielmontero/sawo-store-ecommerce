"use client";

import { useEffect, useRef, useState } from "react";

export function MultiSelectDropdown<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (next: T[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggle(value: T) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  const buttonLabel =
    selected.length === 0
      ? label
      : selected.length === 1
      ? options.find((o) => o.value === selected[0])?.label ?? label
      : `${label} (${selected.length})`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`rounded-md border px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 ${
          selected.length > 0
            ? "border-brand-500 bg-brand-50 text-brand-600"
            : "border-ink-100 bg-gray-50 text-ink-700"
        }`}
      >
        {buttonLabel}
        <span className="ml-1.5 text-ink-400">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 z-10 mt-1 w-48 rounded-md border border-ink-100 bg-white py-1 shadow-lg">
          {options.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-ink-700 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => toggle(option.value)}
                className="h-4 w-4"
              />
              {option.label}
            </label>
          ))}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1 w-full border-t border-ink-100 px-3 py-1.5 text-left text-xs font-medium text-ink-500 hover:text-ink-900"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
