import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/theme";

type AlertVariant = "error" | "warning" | "success" | "info";

interface AlertBannerProps {
  children: string;
  variant?: AlertVariant;
}

const variants = {
  error: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    textColor: "#B91C1C",
  },
  warning: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
    textColor: "#B45309",
  },
  success: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
    textColor: "#15803D",
  },
  info: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    textColor: colors.info,
  },
} as const;

export function AlertBanner({ children, variant = "warning" }: AlertBannerProps) {
  const palette = variants[variant];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
        },
      ]}
    >
      <Text style={[styles.text, { color: palette.textColor }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
});
