"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertBanner, Header, PanelCard } from "@/components";
import {
  bookingsApi,
  getStoredAccessToken,
  messagesApi,
  uploadsApi,
  type CustomerBooking,
  type BookingReview,
} from "@/lib/api";
import {
  formatEuroAmount,
  getBookingLocation,
  getBookingServiceTitle,
  getProviderContactName,
  getProviderDisplayName,
  toDateTimeLocalValue,
} from "@/lib/bookings";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  in_progress: "bg-blue-100 text-blue-800",
  completion_pending: "bg-purple-100 text-purple-800",
  completed: "bg-slate-100 text-slate-700",
  cancelled: "bg-rose-100 text-rose-700",
};

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("customer.bookings");
  const tDetail = useTranslations("customer.bookings.detail");

  const bookingId = params.id as string;

  const [booking, setBooking] = useState<CustomerBooking | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewFiles, setReviewFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const localeTag = locale === "de" ? "de-DE" : "en-US";

  const loadBooking = useCallback(async () => {
    if (!bookingId) {
      setError(tDetail("loadError"));
      setIsLoading(false);
      return;
    }

    const token = getStoredAccessToken();
    if (!token) {
      setError(t("loginRequired"));
      setIsLoading(false);
      return;
    }

    try {
      const result = await bookingsApi.getById(token, bookingId);
      setBooking(result);
      setRescheduleDate(toDateTimeLocalValue(result.scheduledDate));
      setReviewComment(result.review?.comment || "");
    } catch (err) {
      console.error("Failed to load booking details:", err);
      setError(err instanceof Error ? err.message : tDetail("loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [bookingId, t, tDetail]);

  useEffect(() => {
    loadBooking();
  }, [loadBooking]);

  const formatDateTime = (value?: string | null) =>
    value
      ? new Intl.DateTimeFormat(localeTag, {
          dateStyle: "long",
          timeStyle: "short",
        }).format(new Date(value))
      : tDetail("notAvailable");

  const handleMessageProvider = async () => {
    const token = getStoredAccessToken();
    const participantId = booking?.provider?.user.id;

    if (!token || !participantId) {
      setError(t("messageError"));
      return;
    }

    try {
      const conversation = await messagesApi.createConversation(token, {
        participantId,
        requestId: booking?.quote?.request?.id,
      });

      router.push(`/messages?conversation=${conversation.id}`);
    } catch (err) {
      console.error("Failed to message provider:", err);
      setError(err instanceof Error ? err.message : t("messageError"));
    }
  };

  const handleReschedule = async () => {
    const token = getStoredAccessToken();
    if (!token || !booking) {
      setError(t("loginRequired"));
      return;
    }

    const selectedDate = new Date(rescheduleDate);
    if (Number.isNaN(selectedDate.getTime()) || selectedDate <= new Date()) {
      setError(tDetail("invalidDate"));
      return;
    }

    setIsRescheduling(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await bookingsApi.reschedule(token, booking.id, selectedDate.toISOString());
      await loadBooking();
      setSuccessMessage(tDetail("rescheduleSuccess"));
    } catch (err) {
      console.error("Failed to reschedule booking:", err);
      setError(err instanceof Error ? err.message : tDetail("rescheduleError"));
    } finally {
      setIsRescheduling(false);
    }
  };

  const handleCancel = async () => {
    const token = getStoredAccessToken();
    if (!token || !booking) {
      setError(t("loginRequired"));
      return;
    }

    const confirmed = window.confirm(tDetail("cancelConfirm"));
    if (!confirmed) {
      return;
    }

    setIsCancelling(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await bookingsApi.updateStatus(token, booking.id, "cancelled");
      await loadBooking();
      setSuccessMessage(tDetail("cancelSuccess"));
    } catch (err) {
      console.error("Failed to cancel booking:", err);
      setError(err instanceof Error ? err.message : tDetail("cancelError"));
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReviewSubmit = async () => {
    const token = getStoredAccessToken();
    if (!token || !booking) {
      setError(t("loginRequired"));
      return;
    }

    setIsReviewing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      let imageUrls: string[] = [];
      if (reviewFiles.length > 0) {
        const uploads = await uploadsApi.uploadRequestImages(token, reviewFiles);
        imageUrls = uploads.map((upload) => upload.url);
      }

      const review = await bookingsApi.createReview(token, booking.id, {
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
        images: imageUrls,
      });

      setBooking((current) =>
        current
          ? {
              ...current,
              review: review as BookingReview,
            }
          : current,
      );
      setSuccessMessage(tDetail("reviewSuccess"));
      setReviewFiles([]);
    } catch (err) {
      console.error("Failed to submit review:", err);
      setError(err instanceof Error ? err.message : tDetail("reviewError"));
    } finally {
      setIsReviewing(false);
    }
  };

  const handleConfirmCompletion = async () => {
    const token = getStoredAccessToken();
    if (!token || !booking) {
      setError(t("loginRequired"));
      return;
    }

    setError(null);
    setSuccessMessage(null);

    try {
      await bookingsApi.updateStatus(token, booking.id, "completed");
      await loadBooking();
      setSuccessMessage(tDetail("confirmCompletionSuccess"));
    } catch (err) {
      console.error("Failed to confirm completion:", err);
      setError(err instanceof Error ? err.message : tDetail("confirmCompletionError"));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <PanelCard className="text-center text-muted">{t("loading")}</PanelCard>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <AlertBanner variant="warning">{error || tDetail("loadError")}</AlertBanner>
        </div>
      </div>
    );
  }

  const requestHref = booking.quote?.request?.id
    ? `/my-requests/${booking.quote.request.id}`
    : "/my-requests";
  const canManageSchedule = ["pending", "confirmed"].includes(booking.status);
  const reviewAvailableAt = new Date(booking.scheduledDate);
  const isReviewTimeReached = new Date() >= reviewAvailableAt;
  const canReview =
    booking.status !== "cancelled" && !booking.review && isReviewTimeReached;
  const reviewWaitNeeded =
    booking.status !== "cancelled" && !booking.review && !isReviewTimeReached;
  const canConfirmCompletion = booking.status === "completion_pending";
  const categoryLabel =
    locale === "de"
      ? booking.quote?.request?.category?.nameDe
      : booking.quote?.request?.category?.nameEn;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-6 text-sm text-muted">
          <Link href="/bookings" className="hover:text-primary">
            {t("title")}
          </Link>
          {" / "}
          <span>{getBookingServiceTitle(booking)}</span>
        </nav>

        {error && (
          <AlertBanner variant="warning" className="mb-6">
            {error}
          </AlertBanner>
        )}

        {successMessage && (
          <AlertBanner variant="success" className="mb-6">
            {successMessage}
          </AlertBanner>
        )}

        <PanelCard className="mb-6 border border-primary/10 bg-primary/5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[booking.status] || "bg-slate-100 text-slate-700"}`}
                >
                  {t(`status.${booking.status}`)}
                </span>
                <span className="text-sm text-muted">
                  {t(`paymentStatus.${booking.paymentStatus}`)}
                </span>
                {categoryLabel && <span className="text-sm text-muted">{categoryLabel}</span>}
              </div>

              <h1 className="text-2xl font-bold">{getBookingServiceTitle(booking)}</h1>
              <p className="mt-2 text-muted">{tDetail(`statusHelp.${booking.status}`)}</p>

              <div className="mt-4 grid gap-3 text-sm text-muted sm:grid-cols-2">
                <div>
                  <div className="font-medium text-foreground">
                    {tDetail("scheduledFor")}
                  </div>
                  <div>{formatDateTime(booking.scheduledDate)}</div>
                </div>
                <div>
                  <div className="font-medium text-foreground">{tDetail("total")}</div>
                  <div>{formatEuroAmount(booking.totalPrice, locale)}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 lg:justify-end">
              <button
                onClick={handleMessageProvider}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-white"
              >
                {tDetail("sendMessage")}
              </button>
              <Link
                href={requestHref}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-white"
              >
                {tDetail("viewRequest")}
              </Link>
            </div>
          </div>
        </PanelCard>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div className="space-y-6">
            <PanelCard>
              <h2 className="text-lg font-semibold">{tDetail("bookingDetails")}</h2>
              <div className="mt-4 grid gap-4 text-sm text-muted sm:grid-cols-2">
                <div>
                  <div className="font-medium text-foreground">{tDetail("provider")}</div>
                  <div className="mt-1">{getProviderDisplayName(booking.provider)}</div>
                  <div>{getProviderContactName(booking.provider)}</div>
                </div>
                <div>
                  <div className="font-medium text-foreground">{tDetail("location")}</div>
                  <div className="mt-1">{getBookingLocation(booking)}</div>
                </div>
                <div>
                  <div className="font-medium text-foreground">{tDetail("createdOn")}</div>
                  <div className="mt-1">{formatDateTime(booking.createdAt)}</div>
                </div>
                <div>
                  <div className="font-medium text-foreground">{tDetail("completedOn")}</div>
                  <div className="mt-1">{formatDateTime(booking.completedAt)}</div>
                </div>
              </div>
            </PanelCard>

            <PanelCard>
              <h2 className="text-lg font-semibold">{tDetail("requestDetails")}</h2>
              <p className="mt-3 text-sm text-muted">
                {booking.quote?.request?.description || tDetail("noRequestDescription")}
              </p>

              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <div className="font-medium text-foreground">{tDetail("quoteMessage")}</div>
                  <p className="mt-2 rounded-lg bg-background p-4 text-muted">
                    {booking.quote?.message || tDetail("noQuoteMessage")}
                  </p>
                </div>
              </div>
            </PanelCard>
          </div>

          <div className="space-y-6">
            {canManageSchedule && (
              <PanelCard className="sticky top-6">
                <h2 className="text-lg font-semibold">{tDetail("rescheduleTitle")}</h2>
                <p className="mt-2 text-sm text-muted">{tDetail("rescheduleHint")}</p>

                <label className="mt-5 block text-sm font-medium text-foreground">
                  {tDetail("rescheduleDate")}
                </label>
                <input
                  type="datetime-local"
                  value={rescheduleDate}
                  onChange={(event) => setRescheduleDate(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-border px-4 py-3 outline-none transition focus:border-primary"
                />

                <div className="mt-5 flex flex-col gap-3">
                  <button
                    onClick={handleReschedule}
                    disabled={isRescheduling}
                    className="rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRescheduling ? tDetail("rescheduling") : tDetail("reschedule")}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isCancelling}
                    className="rounded-lg border border-rose-200 px-4 py-3 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCancelling ? tDetail("cancelling") : tDetail("cancelBooking")}
                  </button>
                </div>
              </PanelCard>
            )}

            {canReview && (
              <PanelCard>
                <h2 className="text-lg font-semibold">{tDetail("reviewTitle")}</h2>
                <p className="mt-2 text-sm text-muted">{tDetail("reviewHint")}</p>

                <div className="mt-5">
                  <div className="mb-2 text-sm font-medium text-foreground">
                    {tDetail("rating")}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 5 }, (_, index) => index + 1).map((value) => (
                      <button
                        key={value}
                        onClick={() => setReviewRating(value)}
                        className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                          reviewRating === value
                            ? "border-primary bg-primary text-white"
                            : "border-border hover:bg-background"
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="mt-5 block text-sm font-medium text-foreground">
                  {tDetail("comment")}
                </label>
                <textarea
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.target.value)}
                  rows={5}
                  placeholder={tDetail("commentPlaceholder")}
                  className="mt-2 w-full rounded-lg border border-border px-4 py-3 outline-none transition focus:border-primary"
                />

                <label className="mt-5 block text-sm font-medium text-foreground">
                  {tDetail("reviewImagesLabel")}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => setReviewFiles(Array.from(event.target.files || []))}
                  className="mt-2 w-full rounded-lg border border-border px-4 py-3 text-sm"
                />
                {reviewFiles.length > 0 && (
                  <p className="mt-2 text-xs text-muted">
                    {tDetail("reviewImagesSelected", { count: reviewFiles.length })}
                  </p>
                )}

                <button
                  onClick={handleReviewSubmit}
                  disabled={isReviewing}
                  className="mt-5 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isReviewing ? tDetail("submittingReview") : tDetail("submitReview")}
                </button>
              </PanelCard>
            )}

            {canConfirmCompletion && (
              <PanelCard>
                <h2 className="text-lg font-semibold">{tDetail("confirmCompletionTitle")}</h2>
                <p className="mt-2 text-sm text-muted">{tDetail("confirmCompletionHint")}</p>
                <button
                  onClick={handleConfirmCompletion}
                  className="mt-5 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary-dark"
                >
                  {tDetail("confirmCompletion")}
                </button>
              </PanelCard>
            )}

            {reviewWaitNeeded && (
              <PanelCard>
                <h2 className="text-lg font-semibold">{tDetail("reviewTitle")}</h2>
                <p className="mt-2 text-sm text-muted">
                  {tDetail("reviewAvailableAt", { datetime: formatDateTime(reviewAvailableAt.toISOString()) })}
                </p>
              </PanelCard>
            )}

            {booking.review && (
              <PanelCard>
                <h2 className="text-lg font-semibold">{tDetail("yourReview")}</h2>
                <div className="mt-4 flex items-center gap-2">
                  <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                    {booking.review.rating}/5
                  </span>
                  <span className="text-sm text-muted">
                    {formatDateTime(booking.review.createdAt)}
                  </span>
                </div>
                <p className="mt-4 text-sm text-muted">
                  {booking.review.comment || tDetail("noReviewComment")}
                </p>
                {booking.review.images && booking.review.images.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {booking.review.images.map((imageUrl) => (
                      <a
                        key={imageUrl}
                        href={imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-lg border border-border"
                      >
                        <img
                          src={imageUrl}
                          alt="review"
                          className="h-24 w-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )}

                {booking.review.providerReply && (
                  <div className="mt-5 rounded-lg bg-background p-4">
                    <div className="text-sm font-medium text-foreground">
                      {tDetail("providerReply")}
                    </div>
                    <p className="mt-2 text-sm text-muted">
                      {booking.review.providerReply}
                    </p>
                    {booking.review.providerReplyImages &&
                      booking.review.providerReplyImages.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {booking.review.providerReplyImages.map((imageUrl) => (
                            <a
                              key={imageUrl}
                              href={imageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="block overflow-hidden rounded-lg border border-border"
                            >
                              <img
                                src={imageUrl}
                                alt="provider-reply"
                                className="h-24 w-full object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                  </div>
                )}
              </PanelCard>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
