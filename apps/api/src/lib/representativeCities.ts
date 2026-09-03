// One representative address per country, used ONLY for the early shipping
// estimate shown at checkout before the customer has typed a full address
// (see shippingQuote.ts's getShippingQuote) — never for the final charged
// amount, which always uses the customer's real address once it's
// complete. Covers the same country set as apps/web/lib/countries.ts (and
// its storefront duplicate, apps/webshop/lib/countries.ts) so every
// selectable country has an estimate available.
//
// street1 is REQUIRED here, not optional — confirmed live against
// ShipEngine's real rate-quote endpoint: a request with an empty street1
// (city/state/zip only) is rejected outright ("didn't return a rate"),
// even though the destination is otherwise valid. A real, well-known
// street address per country (a recognizable landmark/postal address) is
// used so the estimate is a genuine, accurate ShipEngine quote for that
// street, not a guess.
export const REPRESENTATIVE_CITY_BY_COUNTRY: Record<
  string,
  { street1: string; city: string; state: string; postalCode: string }
> = {
  US: { street1: "350 5th Ave", city: "New York", state: "NY", postalCode: "10001" },
  CA: { street1: "100 Queen St W", city: "Toronto", state: "ON", postalCode: "M5H 2N2" },
  GB: { street1: "10 Downing St", city: "London", state: "London", postalCode: "SW1A 1AA" },
  FR: { street1: "5 Avenue Anatole France", city: "Paris", state: "Île-de-France", postalCode: "75001" },
  DE: { street1: "Pariser Platz 1", city: "Berlin", state: "Berlin", postalCode: "10115" },
  IT: { street1: "Piazza del Colosseo 1", city: "Rome", state: "Lazio", postalCode: "00100" },
  ES: { street1: "Plaza Mayor 1", city: "Madrid", state: "Madrid", postalCode: "28001" },
  NL: { street1: "Dam 1", city: "Amsterdam", state: "North Holland", postalCode: "1011" },
  BE: { street1: "Grand Place 1", city: "Brussels", state: "Brussels", postalCode: "1000" },
  SE: { street1: "Drottninggatan 1", city: "Stockholm", state: "Stockholm", postalCode: "111 21" },
  NO: { street1: "Karl Johans gate 1", city: "Oslo", state: "Oslo", postalCode: "0150" },
  FI: { street1: "Aleksanterinkatu 1", city: "Helsinki", state: "Uusimaa", postalCode: "00100" },
  DK: { street1: "Rådhuspladsen 1", city: "Copenhagen", state: "Capital Region", postalCode: "1050" },
  CH: { street1: "Bahnhofstrasse 1", city: "Zurich", state: "Zurich", postalCode: "8001" },
  AT: { street1: "Stephansplatz 1", city: "Vienna", state: "Vienna", postalCode: "1010" },
  IE: { street1: "O'Connell St 1", city: "Dublin", state: "Dublin", postalCode: "D01" },
  PT: { street1: "Praça do Comércio 1", city: "Lisbon", state: "Lisbon", postalCode: "1100" },
  PL: { street1: "Rynek Starego Miasta 1", city: "Warsaw", state: "Mazovia", postalCode: "00-001" },
  AU: { street1: "483 George St", city: "Sydney", state: "NSW", postalCode: "2000" },
  NZ: { street1: "1 Queen St", city: "Auckland", state: "Auckland", postalCode: "1010" },
  JP: { street1: "1-1 Chiyoda", city: "Tokyo", state: "Tokyo", postalCode: "100-0001" },
  SG: { street1: "1 Fullerton Rd", city: "Singapore", state: "Singapore", postalCode: "018956" },
  MX: { street1: "Plaza de la Constitución 1", city: "Mexico City", state: "CDMX", postalCode: "01000" },
  BR: { street1: "Praça da Sé 1", city: "São Paulo", state: "SP", postalCode: "01000-000" },
};
