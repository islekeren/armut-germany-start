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
        key: forCustomer
          ? "request_cancelled_customer"
          : "request_cancelled_provider",
        requestTitle,
      };
    }
    case "booking_completed": {
      const forCustomer =
        audience === "customer" ||
        (!audience && item.message.includes("is marked as completed"));
      return {
        key: forCustomer
          ? "booking_completed_customer"
          : "booking_completed_provider",
        requestTitle,
      };
    }
    case "booking_cancelled": {
      const byProvider =
        metadata.cancelledBy === "provider" ||
        (!metadata.cancelledBy && item.message.includes("by the provider"));
      return {
        key: byProvider
          ? "booking_cancelled_by_provider"
          : "booking_cancelled_by_customer",
        requestTitle,
      };
    }
    default:
      return null;
  }
}

function getMetadataId(item: Pick<NotificationItem, "metadata">, key: string) {
  const value = item.metadata?.[key];
  return typeof value === "string" && value.length > 0
    ? encodeURIComponent(value)
    : null;
}

export function getNotificationHref(
  item: Pick<NotificationItem, "type" | "metadata">,
  userType?: string,
) {
  const bookingId = getMetadataId(item, "bookingId");
  const requestId = getMetadataId(item, "requestId");
  const quoteId = getMetadataId(item, "quoteId");
  const isProvider = userType === "provider";

  if (isProvider) {
    switch (item.type) {
      case "quote_accepted":
        return quoteId
          ? `/dashboard/offers?offer=${quoteId}`
          : "/dashboard/offers";
      case "request_cancelled":
        return quoteId
          ? `/dashboard/offers?offer=${quoteId}`
          : "/dashboard/offers";
      case "booking_completion_pending":
      case "booking_completed":
      case "booking_cancelled":
        return bookingId
          ? `/dashboard/orders?booking=${bookingId}`
          : "/dashboard/orders";
      case "quote_received":
        return requestId
          ? `/dashboard/listings?request=${requestId}`
          : "/dashboard/listings";
      default:
        return "/dashboard";
    }
  }

  switch (item.type) {
    case "quote_received":
    case "quote_accepted":
    case "request_cancelled":
      return requestId ? `/my-requests/${requestId}` : "/my-requests";
    case "booking_completion_pending":
    case "booking_completed":
    case "booking_cancelled":
      return bookingId ? `/bookings/${bookingId}` : "/bookings";
    default:
      return "/customer-dashboard";
  }
}
