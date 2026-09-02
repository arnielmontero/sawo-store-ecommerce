// Well-known carrier codes EasyPost recognizes for tracker/rate matching —
// not exhaustive, just the common ones staff are likely to actually assign.
// Shared by Configuration (default carrier, carrier rules) and Deliveries
// (per-shipment carrier picker/filter) so there's exactly one list to keep
// in sync rather than duplicated copies drifting apart.
export const CARRIER_OPTIONS = ["USPS", "UPS", "FedEx", "DHL"] as const;
export type Carrier = (typeof CARRIER_OPTIONS)[number];
