import { ActivityIndicator, StyleSheet, Text } from "react-native";
import { PageContainer } from "./PageContainer";
import { colors, spacing } from "@/theme";

interface LoadingScreenProps {
  label?: string;
}

export function LoadingScreen({ label = "Loading..." }: LoadingScreenProps) {
  return (
    <PageContainer scroll={false} style={styles.container}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.label}>{label}</Text>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  label: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "600",
  },
});
