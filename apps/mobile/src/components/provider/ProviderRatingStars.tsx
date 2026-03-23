import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@/theme";

interface ProviderRatingStarsProps {
  rating: number;
  totalReviews?: number;
}

export function ProviderRatingStars({
  rating,
  totalReviews,
}: ProviderRatingStarsProps) {
  const roundedRating = Math.round(rating * 2) / 2;

  return (
    <View style={styles.row}>
      <View style={styles.stars}>
        {Array.from({ length: 5 }, (_, index) => {
          const starValue = index + 1;
          const iconName =
            roundedRating >= starValue
              ? "star"
              : roundedRating + 0.5 === starValue
                ? "star-half"
                : "star-outline";

          return <Ionicons key={starValue} name={iconName} size={16} color={colors.warning} />;
        })}
      </View>

      <Text style={styles.label}>
        {rating.toFixed(1)}
        {typeof totalReviews === "number" ? ` (${totalReviews})` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  stars: {
    flexDirection: "row",
    gap: 2,
  },
  label: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
  },
});
