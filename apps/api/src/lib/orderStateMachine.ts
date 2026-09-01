import { OrderStatus } from "@prisma/client";

// Strict, unidirectional transitions — matches the diagram exactly:
//
//   PENDING --(Payment Success)--> PAID --(Fulfill)--> SHIPPED --(Deliver)--> DELIVERED
//      |                             |                    |
//      +--(Payment Fail/Cancel)      +--(Cancel/Refund)    +--(Return Requested)
//      v                             v                    v
//   CANCELLED                     REFUNDED              RETURNED
//
// DELIVERED, CANCELLED, REFUNDED, and RETURNED are terminal — nothing
// transitions out of them.
//
// PARTIALLY_REFUNDED is the one non-terminal exception, only reachable when
// StoreSettings.allowPartialRefunds is on: PAID/SHIPPED -> PARTIALLY_REFUNDED
// (a refund less than the remaining balance was issued), and from there
// either another partial refund keeps it in PARTIALLY_REFUNDED, or a final
// refund closing out the remaining balance moves it to REFUNDED.
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.SHIPPED, OrderStatus.REFUNDED, OrderStatus.PARTIALLY_REFUNDED],
  [OrderStatus.SHIPPED]: [
    OrderStatus.DELIVERED,
    OrderStatus.RETURNED,
    OrderStatus.REFUNDED,
    OrderStatus.PARTIALLY_REFUNDED,
  ],
  [OrderStatus.DELIVERED]: [],
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
