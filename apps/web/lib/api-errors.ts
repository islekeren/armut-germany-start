import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { ApiError, isApiUnavailableError } from "./api";

// The API answers with English messages. These rules map the ones a user can
// actually run into onto keys in the "apiErrors" message namespace.
const EXACT_MESSAGES: Record<string, string> = {
  "Invalid credentials": "invalidCredentials",
  "Email already registered": "emailTaken",
  "Current password is incorrect": "wrongPassword",
  "Invalid refresh token": "sessionExpired",
  "Provider is not approved": "providerNotApproved",
  "You have already quoted this request": "alreadyQuoted",
  "Request is not open for quotes": "requestClosed",
  "Request is no longer open": "requestClosed",
  "Quote has expired": "quoteExpired",
  "Quote validity date must be in the future": "validityInPast",
  "Scheduled date must be in the future": "dateInPast",
  "Quote is not pending": "quoteNotPending",
  "Can only update pending quotes": "quoteNotPending",
  "Can only withdraw pending quotes": "quoteNotPending",
  "Quote must be accepted first": "quoteNotAccepted",
  "Booking already exists for this quote": "bookingExists",
  "Review already exists": "reviewExists",
  "Can only review completed bookings": "reviewNotAllowed",
  "Cannot reschedule booking at this stage": "rescheduleNotAllowed",
  "Booking must be marked as completion pending before customer confirmation":
    "completionNotRequested",
  "Can only cancel open requests": "cancelNotAllowed",
  "Unknown postal code": "unknownPostalCode",
  "User already has a provider profile": "providerProfileExists",
  "Only customers can create service requests": "customersOnly",
  "No file provided": "noFile",
  "No files provided": "noFile",
};

const PATTERN_RULES: Array<[RegExp, string]> = [
  [/^Account has active bookings/, "activeBookings"],
  [/^Cannot transition from/, "invalidStatusChange"],
  [/^Only (customer|provider)s? can /, "roleNotAllowed"],
  [/^Invalid request (branch|sector)|does not match/, "invalidCategory"],
  [
    /^Not authorized|access required$|^Authentication required|^Not a participant|^User is not a provider|^User must be registered/,
    "notAuthorized",
  ],
  [/not found$/i, "notFound"],
];

/** Key in the "apiErrors" namespace for `error`, or null if unknown. */
export function getApiErrorKey(error: unknown): string | null {
  if (isApiUnavailableError(error)) return "unavailable";
  if (!(error instanceof ApiError)) return null;

  const exact = EXACT_MESSAGES[error.message];
  if (exact) return exact;

  const rule = PATTERN_RULES.find(([pattern]) => pattern.test(error.message));
  if (rule) return rule[1];

  if (error.status === 401) return "sessionExpired";
  if (error.status === 429) return "tooManyRequests";
  return null;
}

/**
 * Returns a function that turns any thrown error into a message in the
 * current language: a specific translation for known API errors, otherwise
 * the caller's translated fallback. Raw server text is never shown.
 */
export function useApiErrorMessage() {
  const t = useTranslations("apiErrors");

  return useCallback(
    (error: unknown, fallback: string) => {
      const key = getApiErrorKey(error);
      return key ? t(key) : fallback;
    },
    [t],
  );
}
