"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ProviderSubpageShell, PanelCard } from "@/components";
import {
  bookingsApi,
  getStoredAccessToken,
  providerApi,
  type ProviderBooking,
} from "@/lib/api";

type OrdersTab = "active" | "completed";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  in_progress: "bg-blue-100 text-blue-800",
  completion_pending: "bg-purple-100 text-purple-800",
  completed: "bg-slate-100 text-slate-700",
  cancelled: "bg-rose-100 text-rose-700",
};

export default function ProviderOrdersPage() {
  const tNav = useTranslations("provider.dashboard.navigation");
  const tOrders = useTranslations("provider.orders");
  const tBookings = useTranslations("customer.bookings.status");
  const locale = useLocale();
  const [orders, setOrders] = useState<ProviderBooking[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ProviderBooking | null>(null);
  const [tab, setTab] = useState<OrdersTab>("active");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const token = getStoredAccessToken();
      if (!token) return;
      const data = await providerApi.getBookings(token);
      setOrders(data);
      if (selectedOrder) {
        const refreshedSelected = data.find((item) => item.id === selectedOrder.id) || null;
        setSelectedOrder(refreshedSelected);
      }
    } catch (err) {
      console.error("Failed to load provider orders:", err);
      setError(err instanceof Error ? err.message : tOrders("loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleOrders = useMemo(() => {
    if (tab === "completed") {
      return orders.filter((order) => order.status === "completed");
    }
    return orders.filter((order) => order.status !== "completed" && order.status !== "cancelled");
  }, [orders, tab]);

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));

  const canRequestCompletion =
    selectedOrder && ["confirmed", "in_progress"].includes(selectedOrder.status);

  const handleRequestCompletion = async () => {
    const token = getStoredAccessToken();
    if (!token || !selectedOrder) return;

    try {
      setSubmitting(true);
      setError(null);
      await bookingsApi.updateStatus(token, selectedOrder.id, "completion_pending");
      await loadOrders();
    } catch (err) {
      console.error("Failed to request completion:", err);
      setError(err instanceof Error ? err.message : tOrders("completeError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProviderSubpageShell title={tNav("orders")} backLabel={tNav("overview")}>
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab("active")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            tab === "active" ? "bg-primary text-white" : "bg-white text-muted"
          }`}
        >
          {tOrders("tabs.active")}
        </button>
        <button
          onClick={() => setTab("completed")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            tab === "completed" ? "bg-primary text-white" : "bg-white text-muted"
          }`}
        >
          {tOrders("tabs.completed")}
        </button>
      </div>

      {error && (
        <PanelCard className="mb-4 border border-rose-200 bg-rose-50 text-rose-700">
          {error}
        </PanelCard>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <PanelCard>
          {loading ? (
            <p className="text-sm text-muted">{tOrders("loading")}</p>
          ) : visibleOrders.length === 0 ? (
            <p className="text-sm text-muted">{tOrders("empty")}</p>
          ) : (
            <div className="space-y-3">
              {visibleOrders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`w-full rounded-lg border p-4 text-left transition ${
                    selectedOrder?.id === order.id ? "border-primary" : "border-border"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold">{order.title}</h3>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLE[order.status] || "bg-slate-100 text-slate-700"}`}
                    >
                      {tBookings(order.status)}
                    </span>
                  </div>
                  <p className="text-sm text-muted">{order.customer}</p>
                  <p className="mt-1 text-sm text-muted">{formatDate(order.scheduledDate)}</p>
                </button>
              ))}
            </div>
          )}
        </PanelCard>

        <PanelCard>
          {!selectedOrder ? (
            <p className="text-sm text-muted">{tOrders("selectOrder")}</p>
          ) : (
            <div>
              <h3 className="text-lg font-semibold">{selectedOrder.title}</h3>
              <p className="mt-1 text-sm text-muted">{selectedOrder.customer}</p>
              <div className="mt-4 space-y-2 text-sm text-muted">
                <p>{formatDate(selectedOrder.scheduledDate)}</p>
                <p>{selectedOrder.address}</p>
                <p>€{selectedOrder.totalPrice}</p>
              </div>

              {canRequestCompletion && (
                <button
                  onClick={handleRequestCompletion}
                  disabled={submitting}
                  className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
                >
                  {submitting ? tOrders("completing") : tOrders("markCompleted")}
                </button>
              )}

              {selectedOrder.status === "completion_pending" && (
                <p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  {tOrders("awaitingCustomer")}
                </p>
              )}
            </div>
          )}
        </PanelCard>
      </div>
    </ProviderSubpageShell>
  );
}
