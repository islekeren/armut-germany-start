import type { NotificationItem } from "./api";

/**
 * The API stores notification text in English. The web app renders it from
 * the notification type instead, using this template key (under
 * "notifications.types") and the request title. Older notifications without
 * the newer metadata fall back to reading their stored English text.
 */
export function getNotificationTemplate(
  item: Pick<NotificationItem, "type" | "message" | "metadata">,
): { key: string; requestTitle: string } | null {
  const metadata = item.metadata ?? {};
  const requestTitle =
    (typeof metadata.requestTitle === "string" && metadata.requestTitle) ||
    item.message.match(/"([^"]+)"/)?.[1] ||
    "";
  const audience =
    typeof metadata.audience === "string" ? metadata.audience : null;

  switch (item.type) {
    case "quote_received":
    case "quote_accepted":
    case "booking_completion_pending":
      return { key: item.type, requestTitle };
    case "request_cancelled": {
      const forCustomer =
        audience === "customer" ||
        (!audience && item.message.startsWith("Your request"));
      return {
        key: forCustomer ? "request_cancelled_customer" : "request_cancelled_provider",
        requestTitle,
      };
    }
    case "booking_completed": {
      const forCustomer =
        audience === "customer" ||
        (!audience && item.message.includes("is marked as completed"));
      return {
        key: forCustomer ? "booking_completed_customer" : "booking_completed_provider",
        requestTitle,
      };
    }
    case "booking_cancelled": {
      const byProvider =
        metadata.cancelledBy === "provider" ||
        (!metadata.cancelledBy && item.message.includes("by the provider"));
      return {
        key: byProvider ? "booking_cancelled_by_provider" : "booking_cancelled_by_customer",
        requestTitle,
      };
    }
    default:
      return null;
  }
}
