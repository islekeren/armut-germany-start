import type {
  BookingStatus,
  CustomerBooking,
  ConversationItem,
  MessageItem,
  Quote,
  ServiceRequest,
} from "@/lib/api";

export type RequestStatus = "active" | "booked" | "completed" | "cancelled";

export interface RequestCard {
  id: string;
  title: string;
  category: string;
  status: RequestStatus;
  createdAt: string;
  location: string;
  quotes: number;
  description: string;
  bookedProvider?: string;
  bookingId?: string;
  acceptedQuoteId?: string;
  hasReview?: boolean;
  completedAt?: string;
  preferredDate?: string;
  budget?: string;
}

export interface BookingCard {
  id: string;
  title: string;
  provider: string;
  service: string;
  status: BookingStatus;
  paymentStatus: string;
  location: string;
  scheduledDate: string;
  totalPrice: number;
  category?: string;
  hasReview: boolean;
}

export interface ConversationCard {
  id: string;
  name: string;
  label: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export const requestStatusMap: Record<
  RequestStatus,
  { label: string; background: string; text: string }
> = {
  active: {
    label: "Active",
    background: "#DCFCE7",
    text: "#15803D",
  },
  booked: {
    label: "Booked",
    background: "#DBEAFE",
    text: "#1D4ED8",
  },
  completed: {
    label: "Completed",
    background: "#E5E7EB",
    text: "#374151",
  },
  cancelled: {
    label: "Cancelled",
    background: "#FFE4E6",
    text: "#BE123C",
  },
};

export const bookingStatusMap: Record<
  BookingStatus,
  { label: string; background: string; text: string }
> = {
  pending: {
    label: "Pending",
    background: "#FEF3C7",
    text: "#B45309",
  },
  confirmed: {
    label: "Confirmed",
    background: "#DCFCE7",
    text: "#15803D",
  },
  in_progress: {
    label: "In progress",
    background: "#DBEAFE",
    text: "#1D4ED8",
  },
  completed: {
    label: "Completed",
    background: "#E5E7EB",
    text: "#374151",
  },
  cancelled: {
    label: "Cancelled",
    background: "#FFE4E6",
    text: "#BE123C",
  },
};

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatShortDateTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatShortDate(value?: string | null) {
  if (!value) return "Flexible";

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function mapApiStatus(status: string): RequestStatus {
  switch (status) {
    case "open":
      return "active";
    case "in_progress":
      return "booked";
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    default:
      return "active";
  }
}

export function getProviderDisplayName(
  booking?: CustomerBooking | null,
  quote?: Quote | null,
) {
  if (booking?.provider) {
    return booking.provider.companyName
      ? booking.provider.companyName
      : `${booking.provider.user.firstName} ${booking.provider.user.lastName}`;
  }

  if (quote?.provider) {
    return quote.provider.companyName
      ? quote.provider.companyName
      : `${quote.provider.user.firstName} ${quote.provider.user.lastName}`;
  }

  return "Unknown provider";
}

export function getBookingServiceTitle(booking: CustomerBooking) {
  return booking.quote?.request?.title || "Booking details";
}

export function getBookingLocation(booking: CustomerBooking) {
  const request = booking.quote?.request;
  if (!request) {
    return "Location unavailable";
  }

  const parts = [request.address, request.postalCode, request.city].filter(Boolean);
  return parts.join(", ");
}

export function getConversationLabel(conversation?: ConversationItem | null) {
  if (conversation?.request?.category?.nameEn) {
    return conversation.request.category.nameEn;
  }

  return conversation?.request?.title || "Conversation";
}

export function getOtherParticipantName(
  conversation?: ConversationItem | null,
  currentUserId?: string,
) {
  if (conversation?.otherParticipant) {
    return `${conversation.otherParticipant.firstName} ${conversation.otherParticipant.lastName}`;
  }

  const fallbackUser = conversation?.participants
    ?.map((participant) => participant.user)
    .find((participantUser) => participantUser?.id !== currentUserId);

  if (!fallbackUser) return "Unknown user";
  return `${fallbackUser.firstName} ${fallbackUser.lastName}`;
}

export function getLastMessage(messages?: MessageItem[]) {
  if (!messages || messages.length === 0) {
    return "No messages yet";
  }

  return messages[messages.length - 1]?.content || "No messages yet";
}

export function transformRequest(
  request: ServiceRequest,
  context: {
    bookingsByRequestId: Map<string, CustomerBooking>;
    acceptedQuotesByRequestId: Map<string, Quote>;
  },
): RequestCard {
  const booking = context.bookingsByRequestId.get(request.id);
  const acceptedQuote = context.acceptedQuotesByRequestId.get(request.id);

  const category =
    request.category?.nameEn || request.category?.slug || request.categoryId;

  const priceParts = [];
  if (request.budgetMin !== undefined) {
    priceParts.push(`From €${request.budgetMin}`);
  }
  if (request.budgetMax !== undefined) {
    priceParts.push(`Up to €${request.budgetMax}`);
  }

  return {
    id: request.id,
    title: request.title,
    category,
    status: mapApiStatus(request.status),
    createdAt: new Intl.DateTimeFormat("de-DE", {
      dateStyle: "long",
    }).format(new Date(request.createdAt)),
    location: [request.postalCode, request.city].filter(Boolean).join(" "),
    quotes: request._count?.quotes ?? request.quotes?.length ?? 0,
    description: request.description,
    bookedProvider: getProviderDisplayName(booking, acceptedQuote),
    bookingId: booking?.id,
    acceptedQuoteId: acceptedQuote?.id,
    hasReview: Boolean(booking?.review),
    completedAt: booking?.completedAt
      ? new Intl.DateTimeFormat("de-DE", {
          dateStyle: "long",
        }).format(new Date(booking.completedAt))
      : undefined,
    preferredDate: formatShortDate(request.preferredDate),
    budget: priceParts.length > 0 ? priceParts.join(" · ") : "Flexible budget",
  };
}

export function transformBooking(booking: CustomerBooking): BookingCard {
  return {
    id: booking.id,
    title: getBookingServiceTitle(booking),
    provider: getProviderDisplayName(booking),
    service: booking.quote?.request?.category?.nameEn || "Service booking",
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    location: getBookingLocation(booking),
    scheduledDate: formatShortDateTime(booking.scheduledDate),
    totalPrice: booking.totalPrice,
    category: booking.quote?.request?.category?.nameEn,
    hasReview: Boolean(booking.review),
  };
}

export function transformConversation(
  conversation: ConversationItem,
  currentUserId?: string,
): ConversationCard {
  return {
    id: conversation.id,
    name: getOtherParticipantName(conversation, currentUserId),
    label: getConversationLabel(conversation),
    lastMessage: getLastMessage(conversation.messages),
    lastMessageAt: formatShortDateTime(conversation.lastMessageAt),
    unreadCount: conversation.unreadCount || 0,
  };
}
