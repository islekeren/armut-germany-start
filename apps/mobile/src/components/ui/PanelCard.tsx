import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radii, shadows, spacing } from "@/theme";

interface PanelCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function PanelCard({ children, style }: PanelCardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.xl,
    ...shadows.card,
  },
});
