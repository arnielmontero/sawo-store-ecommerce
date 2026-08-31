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
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.SHIPPED, OrderStatus.REFUNDED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.RETURNED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
  [OrderStatus.RETURNED]: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function getAllowedNextStates(from: OrderStatus): OrderStatus[] {
  return ALLOWED_TRANSITIONS[from];
}
