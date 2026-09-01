import { OrderStatus } from "@prisma/client";

// Strict, unidirectional transitions — matches the diagram exactly:
//
//   PENDING --(Payment Success)--> PAID --(Fulfill)--> SHIPPED --(Deliver)--> DELIVERED
//      |                             |                    |                     |
//      +--(Payment Fail/Cancel)      +--(Cancel/Refund)    +--(Return Requested) +--(Refund)
//      v                             v                    v                     v
//   CANCELLED                     REFUNDED              RETURNED              REFUNDED
//
// CANCELLED and RETURNED are terminal — nothing transitions out of them.
//
// DELIVERED can still move to REFUNDED/PARTIALLY_REFUNDED — "it arrived and
// the customer wants a refund" (via a return request, see
// returnRequest.service.ts, or a plain refund) is the single most common
// real-world return case, so delivery doesn't close off refunding the way
// it closes off every other transition.
//
// PARTIALLY_REFUNDED is the one non-terminal exception, only reachable when
// StoreSettings.allowPartialRefunds is on: PAID/SHIPPED/DELIVERED ->
// PARTIALLY_REFUNDED (a refund less than the remaining balance was issued),
// and from there either another partial refund keeps it in
// PARTIALLY_REFUNDED, or a final refund closing out the remaining balance
// moves it to REFUNDED.
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.SHIPPED, OrderStatus.REFUNDED, OrderStatus.PARTIALLY_REFUNDED],
  [OrderStatus.SHIPPED]: [
    OrderStatus.DELIVERED,
    OrderStatus.RETURNED,
    OrderStatus.REFUNDED,
    OrderStatus.PARTIALLY_REFUNDED,
  ],
  [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED, OrderStatus.PARTIALLY_REFUNDED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
  [OrderStatus.RETURNED]: [],
  [OrderStatus.PARTIALLY_REFUNDED]: [OrderStatus.PARTIALLY_REFUNDED, OrderStatus.REFUNDED],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function getAllowedNextStates(from: OrderStatus): OrderStatus[] {
  return ALLOWED_TRANSITIONS[from];
}
