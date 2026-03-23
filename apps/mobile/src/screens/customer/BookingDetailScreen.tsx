import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { AlertBanner, AppButton, LoadingScreen, PageContainer, PanelCard, SectionHeader } from "@/components";
import { useAuth } from "@/providers/AuthProvider";
import { bookingsApi, messagesApi, type CustomerBooking } from "@/lib/api";
import { colors, radii, spacing } from "@/theme";
import { StatusPill } from "./StatusPill";
import { bookingStatusMap, formatCurrency, transformBooking } from "./helpers";

export function BookingDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const bookingId = typeof params.id === "string" ? params.id : "";
  const { accessToken } = useAuth();

  const [booking, setBooking] = useState<CustomerBooking | null>(null);
  const [reviewRating, setReviewRating] = useState("5");
  const [reviewComment, setReviewComment] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadBooking() {
      if (!bookingId) {
        setError("Booking not found.");
        setIsLoading(false);
        return;
      }

      if (!accessToken) {
        setError("Please log in to view booking details.");
        setIsLoading(false);
        return;
      }

      try {
        setError(null);
        const result = await bookingsApi.getById(accessToken, bookingId);
        if (!isMounted) return;
        setBooking(result);
        setReviewComment(result.review?.comment || "");
        setReviewRating(String(result.review?.rating || 5));
      } catch (loadError) {
        if (!isMounted) return;
        console.error("Failed to load booking detail:", loadError);
        setError(loadError instanceof Error ? loadError.message : "Failed to load booking");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadBooking();

    return () => {
      isMounted = false;
    };
  }, [accessToken, bookingId]);

  const viewModel = booking ? transformBooking(booking) : null;

  const handleMessageProvider = async () => {
    if (!accessToken || !booking?.provider?.user.id) {
      setError("Unable to contact the provider right now.");
      return;
    }

    try {
      const conversation = await messagesApi.createConversation(accessToken, {
        participantId: booking.provider.user.id,
        requestId: booking.quote?.request?.id,
      });
      router.push({ pathname: "/(customer)/messages/[id]", params: { id: conversation.id } });
    } catch (messageError) {
      console.error("Failed to message provider:", messageError);
      setError(messageError instanceof Error ? messageError.message : "Failed to open conversation");
    }
  };

  const handleSaveReview = async () => {
    if (!accessToken || !booking) {
      setError("Please log in to continue.");
      return;
    }

    if (!reviewRating.trim() || Number.isNaN(Number(reviewRating))) {
      setError("Please enter a valid rating.");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);
      await bookingsApi.createReview(accessToken, booking.id, {
        rating: Number(reviewRating),
        comment: reviewComment.trim() || undefined,
      });
      setSuccessMessage("Review saved successfully.");
      const refreshed = await bookingsApi.getById(accessToken, booking.id);
      setBooking(refreshed);
    } catch (saveError) {
      console.error("Failed to save review:", saveError);
      setError(saveError instanceof Error ? saveError.message : "Failed to save review");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingScreen label="Loading booking details..." />;
  }

  return (
    <PageContainer>
      <SectionHeader
        eyebrow="Customer"
        title={viewModel?.title || "Booking details"}
        subtitle={viewModel?.provider || "Booking overview"}
      />

      {error ? <AlertBanner>{error}</AlertBanner> : null}
      {successMessage ? <AlertBanner variant="success">{successMessage}</AlertBanner> : null}

      {booking && viewModel ? (
        <>
          <PanelCard style={styles.summaryCard}>
            <View style={styles.rowBetween}>
              <StatusPill
                label={bookingStatusMap[booking.status].label}
                backgroundColor={bookingStatusMap[booking.status].background}
                textColor={bookingStatusMap[booking.status].text}
              />
              <Text style={styles.meta}>{booking.paymentStatus}</Text>
            </View>
            <Text style={styles.title}>{viewModel.title}</Text>
            <Text style={styles.description}>{viewModel.provider}</Text>
            <Text style={styles.meta}>{viewModel.scheduledDate}</Text>
            <Text style={styles.meta}>{viewModel.location}</Text>
            <Text style={styles.meta}>{formatCurrency(booking.totalPrice)}</Text>
          </PanelCard>

          <PanelCard style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Actions</Text>
            <View style={styles.actionRow}>
              <AppButton label="Message provider" fullWidth={false} onPress={handleMessageProvider} />
              <AppButton
                label="Open request"
                variant="outline"
                fullWidth={false}
                onPress={() =>
                  booking.quote?.request?.id
                    ? router.push({ pathname: "/(customer)/requests/[id]", params: { id: booking.quote.request.id } })
                    : null
                }
              />
            </View>
          </PanelCard>

          <PanelCard style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Review</Text>
            {booking.review ? (
              <>
                <Text style={styles.description}>
                  Your review is already attached to this booking.
                </Text>
                <Text style={styles.meta}>Rating: {booking.review.rating}</Text>
                <Text style={styles.description}>{booking.review.comment || "No comment provided."}</Text>
              </>
            ) : (
              <>
                <Text style={styles.description}>Leave a quick review after the job is complete.</Text>
                <TextInput
                  value={reviewRating}
                  onChangeText={setReviewRating}
                  placeholder="Rating from 1 to 5"
                  keyboardType="number-pad"
                  style={styles.input}
                />
                <TextInput
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  placeholder="Write your review"
                  multiline
                  style={[styles.input, styles.textArea]}
                />
                <AppButton label={isSaving ? "Saving..." : "Save review"} onPress={handleSaveReview} />
              </>
            )}
          </PanelCard>
        </>
      ) : null}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    gap: spacing.sm,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: "800",
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "800",
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.foreground,
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: "top",
  },
});
