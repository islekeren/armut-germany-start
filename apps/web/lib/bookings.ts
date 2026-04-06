import type { BookingStatus, CustomerBooking, ProviderBooking, Quote } from "./api";

type ProviderLike =
  | CustomerBooking["provider"]
  | Quote["provider"]
  | null
  | undefined;

type RequestLike =
  | NonNullable<NonNullable<CustomerBooking["quote"]>["request"]>
  | Quote["request"]
  | null
  | undefined;

export function getProviderDisplayName(provider: ProviderLike) {
  if (!provider) {
    return "Provider";
  }

  const fallbackName = `${provider.user.firstName} ${provider.user.lastName}`.trim();
  return provider.companyName?.trim() || fallbackName || "Provider";
}

export function getProviderContactName(provider: ProviderLike) {
  if (!provider) {
    return "";
  }

  return `${provider.user.firstName} ${provider.user.lastName}`.trim();
}

export function getRequestTitle(request: RequestLike) {
  return request?.title?.trim() || "Service request";
}

export function getRequestLocation(request: RequestLike) {
  if (!request) {
    return "Location not provided";
  }

  const location = [request.address, request.postalCode, request.city]
    .filter(Boolean)
    .join(", ");

  return location || "Location not provided";
}

export function getBookingServiceTitle(booking: CustomerBooking) {
  return getRequestTitle(booking.quote?.request);
}

export function getBookingLocation(booking: CustomerBooking) {
  return getRequestLocation(booking.quote?.request);
}

export function toDateTimeLocalValue(value: Date | string) {
  const date = new Date(value);
  const normalized = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return normalized.toISOString().slice(0, 16);
}

export function getDefaultScheduledDateValue() {
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 1);
  defaultDate.setHours(10, 0, 0, 0);
  return toDateTimeLocalValue(defaultDate);
}

export function formatEuroAmount(value: number, locale: string) {
  return new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export type BookingDisplayStatus =
  | "pending"
  | "booked"
  | "completed"
  | "cancelled";

export function toBookingDisplayStatus(
  status: BookingStatus | ProviderBooking["status"] | string,
): BookingDisplayStatus {
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  if (
    status === "confirmed" ||
    status === "in_progress" ||
    status === "completion_pending"
  ) {
    return "booked";
  }

  return "pending";
}

export function getBookingDisplayStatusClass(status: BookingDisplayStatus) {
  switch (status) {
    case "booked":
      return "bg-blue-100 text-blue-800";
    case "completed":
      return "bg-emerald-100 text-emerald-800";
    case "cancelled":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-amber-100 text-amber-800";
  }
}
