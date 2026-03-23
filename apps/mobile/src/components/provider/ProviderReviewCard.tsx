import { StyleSheet, Text, View } from "react-native";
import { PanelCard } from "@/components/ui/PanelCard";
import { ProviderRatingStars } from "./ProviderRatingStars";
import { colors, spacing } from "@/theme";

interface ProviderReviewCardProps {
  reviewer: string;
  service: string;
  rating: number;
  date: string;
  comment?: string | null;
  providerReply?: string | null;
}

export function ProviderReviewCard({
  reviewer,
  service,
  rating,
  date,
  comment,
  providerReply,
}: ProviderReviewCardProps) {
  return (
    <PanelCard style={styles.card}>
      <View style={styles.header}>
        <View style={styles.meta}>
          <Text style={styles.reviewer}>{reviewer}</Text>
          <Text style={styles.service}>{service}</Text>
        </View>
        <Text style={styles.date}>{date}</Text>
      </View>

      <ProviderRatingStars rating={rating} />

      {comment ? <Text style={styles.comment}>{comment}</Text> : null}

      {providerReply ? (
        <View style={styles.replyBox}>
          <Text style={styles.replyLabel}>Reply</Text>
          <Text style={styles.replyText}>{providerReply}</Text>
        </View>
      ) : null}
    </PanelCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  reviewer: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "700",
  },
  service: {
    color: colors.muted,
    fontSize: 14,
  },
  date: {
    color: colors.muted,
    fontSize: 13,
  },
  comment: {
    color: colors.foreground,
    fontSize: 15,
    lineHeight: 22,
  },
  replyBox: {
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    padding: spacing.md,
    gap: spacing.xs,
  },
  replyLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  replyText: {
    color: colors.foreground,
    fontSize: 14,
    lineHeight: 20,
  },
});
