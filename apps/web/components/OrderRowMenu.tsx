"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Order, OrderStatus } from "@/lib/api";
import { NEXT_STATES, ACTION_LABELS } from "@/lib/orderStateMachine";

export function OrderRowMenu({
  order,
  canAct,
  onTransition,
}: {
  order: Order;
  canAct: boolean;
  onTransition: (orderId: number, status: OrderStatus) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const nextStates = NEXT_STATES[order.status];

  async function handleTransition(status: OrderStatus) {
    setPending(true);
    try {
      await onTransition(order.id, status);
    } finally {
      setPending(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-md px-2 py-1 text-ink-400 hover:bg-gray-100 hover:text-ink-700"
        aria-label="Order actions"
      >
        •••
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-ink-100 bg-white py-1 text-left shadow-lg">
          <button
            onClick={() => router.push(`/orders/${order.id}`)}
            className="block w-full px-4 py-2 text-left text-sm text-ink-700 hover:bg-gray-50"
          >
            View order
          </button>
          {canAct &&
            nextStates.map((status) => (
              <button
                key={status}
                disabled={pending}
                onClick={() => handleTransition(status)}
                className="block w-full px-4 py-2 text-left text-sm text-ink-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {ACTION_LABELS[status]}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
