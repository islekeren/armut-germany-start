import { StyleSheet, Text, View } from "react-native";
import { radii, spacing } from "@/theme";

interface StatusPillProps {
  label: string;
  backgroundColor: string;
  textColor: string;
}

export function StatusPill({
  label,
  backgroundColor,
  textColor,
}: StatusPillProps) {
  return (
    <View style={[styles.pill, { backgroundColor }]}>
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
});
