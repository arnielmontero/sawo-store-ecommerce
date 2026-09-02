import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";
import { CARRIER_OPTIONS } from "@/lib/constants";
import { COUNTRIES } from "@/lib/countries";

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));
const CARRIER_FILTER_OPTIONS = CARRIER_OPTIONS.map((c) => ({ value: c, label: c }));

// Shared by all three Deliveries tabs — search box, Carrier/Country
// multi-select filters, Clear filters, Export CSV. Each tab owns its own
// filter state and passes it down here rather than this component holding
// any state itself, so switching tabs never carries a stale filter over
// from a different tab's semantics.
export function ShipmentFilterBar({
  searchInput,
  onSearchInputChange,
  carrier,
  onCarrierChange,
  country,
  onCountryChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  hasFilters,
  onClearFilters,
  onExport,
  searchPlaceholder = "Search by reference, tracking number, or customer email...",
}: {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  carrier: string[];
  onCarrierChange: (next: string[]) => void;
  country: string[];
  onCountryChange: (next: string[]) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  hasFilters: boolean;
  onClearFilters: () => void;
  onExport: () => void;
  searchPlaceholder?: string;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-96 rounded-md border border-ink-100 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
        />
        <button
          onClick={onExport}
          className="shrink-0 rounded-md border border-ink-100 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-gray-50"
        >
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-5 py-3">
        <MultiSelectDropdown label="All carriers" options={CARRIER_FILTER_OPTIONS} selected={carrier} onChange={onCarrierChange} />
        <MultiSelectDropdown label="All countries" options={COUNTRY_OPTIONS} selected={country} onChange={onCountryChange} />
        <div className="flex items-center gap-1.5 text-sm text-ink-500">
          <span>From</span>
          <input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="rounded-md border border-ink-100 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
          />
          <span>to</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => onDateToChange(e.target.value)}
            className="rounded-md border border-ink-100 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
          />
        </div>
        {hasFilters && (
          <button
            onClick={onClearFilters}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-500 hover:bg-gray-50 hover:text-ink-900"
          >
            Clear filters
          </button>
        )}
      </div>
    </>
  );
}
