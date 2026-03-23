import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { AppButton, PageContainer, PanelCard, SectionHeader } from "@/components";
import { colors, spacing, typography } from "@/theme";

export function PublicProfileScreen() {
  return (
    <PageContainer>
      <SectionHeader
        eyebrow="Account"
        title="Your mobile entry point"
        subtitle="Sign in, create an account, or start the provider flow from one native screen."
      />

      <PanelCard style={styles.heroCard}>
        <Text style={styles.heroTitle}>Choose your path</Text>
        <Text style={styles.heroCopy}>
          This tab works as the public account area for logged-out users. Once signed in, the
          customer and provider tabs take over automatically.
        </Text>
      </PanelCard>

      <View style={styles.actions}>
        <ActionCard
          title="Customer"
          description="Book services, track requests, and manage bookings."
          ctaLabel="Log in"
          onPress={() => router.push("/(auth)/login")}
        />
        <ActionCard
          title="Provider"
          description="Create an account and move toward a native provider dashboard."
          ctaLabel="Register as provider"
          onPress={() => router.push({ pathname: "/(auth)/register", params: { role: "provider" } })}
        />
        <ActionCard
          title="New here?"
          description="Browse the app as a guest and jump into the experience when you are ready."
          ctaLabel="Create account"
          onPress={() => router.push("/(auth)/register")}
        />
      </View>

      <PanelCard style={styles.noteCard}>
        <Text style={styles.noteTitle}>What happens next</Text>
        <Text style={styles.noteCopy}>
          After authentication, the app redirects into the correct native tab set based on your
          account type.
        </Text>
      </PanelCard>
    </PageContainer>
  );
}

function ActionCard({
  title,
  description,
  ctaLabel,
  onPress,
}: {
  title: string;
  description: string;
  ctaLabel: string;
  onPress: () => void;
}) {
  return (
    <PanelCard style={styles.actionCard}>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionCopy}>{description}</Text>
      <AppButton label={ctaLabel} onPress={onPress} />
    </PanelCard>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: spacing.sm,
    backgroundColor: "#F2F8FF",
  },
  heroTitle: {
    color: colors.foreground,
    fontSize: typography.subtitle,
    fontWeight: "800",
  },
  heroCopy: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  actions: {
    gap: spacing.md,
  },
  actionCard: {
    gap: spacing.sm,
  },
  actionTitle: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "800",
  },
  actionCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  noteCard: {
    gap: spacing.xs,
    backgroundColor: "#FFF7F0",
  },
  noteTitle: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  noteCopy: {
    color: colors.foreground,
    fontSize: 14,
    lineHeight: 21,
  },
});
