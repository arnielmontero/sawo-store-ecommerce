// ISO 3166-1 alpha-2 country list for the Configuration rule dropdowns
// (carrier rules, payment method rules) — a curated set of commonly
// shipped-to countries rather than the full ~249-entry ISO list, since a
// plain <select> isn't searchable and a shorter list is easier to scan.
// Includes every country the seed data actually uses (US/CA/FR/DE/AU, see
// seedData.ts's ADDRESSES/INTL_ADDRESSES) plus other common destinations.
export const COUNTRIES: { code: string; name: string }[] = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "FI", name: "Finland" },
  { code: "DK", name: "Denmark" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" },
  { code: "IE", name: "Ireland" },
  { code: "PT", name: "Portugal" },
  { code: "PL", name: "Poland" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "JP", name: "Japan" },
  { code: "SG", name: "Singapore" },
  { code: "MX", name: "Mexico" },
  { code: "BR", name: "Brazil" },
].sort((a, b) => a.name.localeCompare(b.name));

export function countryName(code: string) {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}
