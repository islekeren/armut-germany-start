import { StyleSheet, Text, View } from "react-native";
import { AppButton } from "./AppButton";
import { PageContainer } from "./PageContainer";
import { PanelCard } from "./PanelCard";
import { SectionHeader } from "./SectionHeader";
import { colors, radii, spacing, typography } from "@/theme";

interface ScreenPlaceholderProps {
  title: string;
  description: string;
  eyebrow?: string;
  highlights?: string[];
  ctaLabel?: string;
  onPressCta?: () => void;
}

export function ScreenPlaceholder({
  title,
  description,
  eyebrow = "Mobile",
  highlights = [
    "Shared layout and component primitives are ready.",
    "API and auth plumbing are connected to the monorepo backend.",
    "This route is set up for the next implementation pass.",
  ],
  ctaLabel,
  onPressCta,
}: ScreenPlaceholderProps) {
  return (
    <PageContainer>
      <SectionHeader eyebrow={eyebrow} title={title} subtitle={description} />

      <PanelCard style={styles.heroCard}>
        <Text style={styles.heroTitle}>Native shell in place</Text>
        <Text style={styles.heroText}>
          This screen already lives inside the Expo Router navigation tree and uses the shared
          design system pieces that mirror the web app.
        </Text>
        {ctaLabel ? <AppButton label={ctaLabel} onPress={onPressCta} fullWidth={false} /> : null}
      </PanelCard>

      <View style={styles.grid}>
        {highlights.map((item) => (
          <PanelCard key={item} style={styles.highlightCard}>
            <View style={styles.badge} />
            <Text style={styles.highlightText}>{item}</Text>
          </PanelCard>
        ))}
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: spacing.md,
  },
  heroTitle: {
    color: colors.foreground,
    fontSize: typography.subtitle,
    fontWeight: "800",
  },
  heroText: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 24,
  },
  grid: {
    gap: spacing.md,
  },
  highlightCard: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  badge: {
    width: 12,
    height: 12,
    borderRadius: radii.full,
    backgroundColor: colors.secondary,
  },
  highlightText: {
    flex: 1,
    color: colors.foreground,
    fontSize: typography.body,
    lineHeight: 22,
  },
});
