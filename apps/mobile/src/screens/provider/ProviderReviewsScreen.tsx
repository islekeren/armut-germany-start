import { useEffect, useState } from "react";
import {
  AlertBanner,
  AppButton,
  FormTextarea,
  LoadingScreen,
  PageContainer,
  PanelCard,
  ProviderRatingStars,
  ProviderReviewCard,
  SectionHeader,
} from "@/components";
import { providerApi, type ProviderReview } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/theme";
import { formatLongDate } from "./shared";

interface ReviewStats {
  average: number;
  total: number;
  breakdown: Record<number, number>;
}

export function ProviderReviewsScreen() {
  const { accessToken } = useAuth();
  const [reviews, setReviews] = useState<ProviderReview[]>([]);
  const [stats, setStats] = useState<ReviewStats>({
    average: 0,
    total: 0,
    breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadReviews() {
      if (!accessToken) {
        setError("Missing provider session. Please log in again.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await providerApi.getReviews(accessToken);
        if (!mounted) return;
        setReviews(response.data);
        setStats(response.stats);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load reviews.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadReviews();

    return () => {
      mounted = false;
    };
  }, [accessToken]);

  async function handleReply(reviewId: string) {
    if (!accessToken || !replyText.trim()) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await providerApi.replyToReview(accessToken, reviewId, replyText.trim());
      setReviews((current) =>
        current.map((review) =>
          review.id === reviewId ? { ...review, reply: replyText.trim() } : review,
        ),
      );
      setReplyText("");
      setReplyingTo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reply.");
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return <LoadingScreen label="Loading provider reviews..." />;
  }

  return (
    <PageContainer>
      <SectionHeader
        eyebrow="Reviews"
        title="Customer feedback"
        subtitle="Track your overall rating and respond to reviews in a native mobile flow."
      />

      {error ? <AlertBanner variant="warning">{error}</AlertBanner> : null}

      <PanelCard style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View>
            <Text style={styles.summaryValue}>{stats.average.toFixed(1)}</Text>
            <ProviderRatingStars rating={stats.average} totalReviews={stats.total} />
          </View>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryPillText}>{stats.total} reviews</Text>
          </View>
        </View>

        <View style={styles.breakdownStack}>
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = stats.breakdown[stars] || 0;
            const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
            return (
              <View key={stars} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{stars}★</Text>
                <View style={styles.breakdownBar}>
                  <View style={[styles.breakdownFill, { width: `${percentage}%` }]} />
                </View>
                <Text style={styles.breakdownCount}>{count}</Text>
              </View>
            );
          })}
        </View>
      </PanelCard>

      <View style={styles.stack}>
        {reviews.length === 0 ? (
          <PanelCard>
            <Text style={styles.emptyTitle}>No reviews yet</Text>
            <Text style={styles.emptyText}>
              Once customers finish their jobs, their feedback will appear here.
            </Text>
          </PanelCard>
        ) : (
          reviews.map((review) => (
            <View key={review.id} style={styles.reviewBlock}>
              <ProviderReviewCard
                reviewer={review.customer}
                service={review.service}
                rating={review.rating}
                date={formatLongDate(review.date)}
                comment={review.comment}
                providerReply={review.reply}
              />

              {!review.reply && replyingTo !== review.id ? (
                <AppButton
                  label="Reply"
                  onPress={() => setReplyingTo(review.id)}
                  fullWidth={false}
                  variant="ghost"
                />
              ) : null}

              {!review.reply && replyingTo === review.id ? (
                <PanelCard style={styles.replyComposer}>
                  <Text style={styles.replyTitle}>Write a reply</Text>
                  <FormTextarea
                    value={replyText}
                    onChangeText={setReplyText}
                    placeholder="Thank the customer and add any context you want to share."
                  />
                  <View style={styles.replyActions}>
                    <AppButton
                      label={isSaving ? "Sending..." : "Send reply"}
                      onPress={() => handleReply(review.id)}
                      disabled={isSaving}
                    />
                    <AppButton
                      label="Cancel"
                      onPress={() => {
                        setReplyingTo(null);
                        setReplyText("");
                      }}
                      fullWidth={false}
                      variant="outline"
                    />
                  </View>
                </PanelCard>
              ) : null}
            </View>
          ))
        )}
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    gap: spacing.lg,
  },
  summaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  summaryValue: {
    color: colors.primary,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "900",
  },
  summaryPill: {
    alignSelf: "flex-start",
    borderRadius: radii.full,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  summaryPillText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  breakdownStack: {
    gap: spacing.sm,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  breakdownLabel: {
    width: 28,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  breakdownBar: {
    flex: 1,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },
  breakdownFill: {
    height: "100%",
    borderRadius: radii.full,
    backgroundColor: colors.warning,
  },
  breakdownCount: {
    width: 24,
    textAlign: "right",
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  stack: {
    gap: spacing.md,
  },
  reviewBlock: {
    gap: spacing.sm,
  },
  replyComposer: {
    gap: spacing.md,
  },
  replyTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "800",
  },
  replyActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "800",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
});
