"use client";

import { useState } from "react";
import { DeliveryStatsBar } from "@/components/DeliveryStatsBar";
import { PendingTab } from "./PendingTab";
import { InTransitTab } from "./InTransitTab";
import { HistoryTab } from "./HistoryTab";

type Tab = "pending" | "in-transit" | "history";

export default function DeliveriesPage() {
  const [tab, setTab] = useState<Tab>("pending");

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink-900">Deliveries</h1>
      </div>
      <p className="mt-1 text-sm text-ink-500">
        Orders paid and waiting to be shipped, live status once they're on the way, and a browsable history once delivered or returned.
      </p>

      <DeliveryStatsBar />

      <div className="mt-6 flex gap-1 border-b border-ink-100">
        <button
          onClick={() => setTab("pending")}
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            tab === "pending" ? "border-brand-500 text-brand-600" : "border-transparent text-ink-500 hover:text-ink-700"
          }`}
        >
          Pending delivery
        </button>
        <button
          onClick={() => setTab("in-transit")}
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            tab === "in-transit" ? "border-brand-500 text-brand-600" : "border-transparent text-ink-500 hover:text-ink-700"
          }`}
        >
          In transit
        </button>
        <button
          onClick={() => setTab("history")}
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            tab === "history" ? "border-brand-500 text-brand-600" : "border-transparent text-ink-500 hover:text-ink-700"
          }`}
        >
          Delivered / Returned
        </button>
      </div>

      {tab === "pending" && <PendingTab />}
      {tab === "in-transit" && <InTransitTab />}
      {tab === "history" && <HistoryTab />}
    </div>
  );
}
