import type { PaymentMethod } from "./api";

export function formatCents(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  PAY_WITH_CHECK: "Pay with Check",
  PAYPAL: "PayPal",
  BANK: "Bank",
  CARD: "Card",
};

export function formatPaymentMethod(method: PaymentMethod) {
  return PAYMENT_LABELS[method];
}
