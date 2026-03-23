import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { AppButton, PageContainer, PanelCard, SectionHeader } from "@/components";
import { useAuth } from "@/providers/AuthProvider";
import { colors, radii, spacing } from "@/theme";

export function CustomerAccountScreen() {
  const { user, logout } = useAuth();

  const initials = useMemo(() => {
    const first = user?.firstName?.charAt(0) || "";
    const last = user?.lastName?.charAt(0) || "";
    return `${first}${last}` || "CU";
  }, [user?.firstName, user?.lastName]);

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <PageContainer>
      <SectionHeader
        eyebrow="Customer"
        title="Account"
        subtitle="Review your profile and move quickly between customer actions."
      />

      <PanelCard style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.profileTextBlock}>
          <Text style={styles.profileName}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={styles.profileMeta}>{user?.email}</Text>
          <Text style={styles.profileMeta}>Customer account</Text>
        </View>
      </PanelCard>

      <View style={styles.quickGrid}>
        <PanelCard style={styles.quickCard}>
          <Text style={styles.quickLabel}>Messages</Text>
          <Text style={styles.quickValue}>Jump back into conversations with providers.</Text>
          <AppButton
            label="Open messages"
            variant="outline"
            fullWidth={false}
            onPress={() => router.push("/(customer)/(tabs)/messages")}
          />
        </PanelCard>
        <PanelCard style={styles.quickCard}>
          <Text style={styles.quickLabel}>Requests</Text>
          <Text style={styles.quickValue}>Track the status of current and past requests.</Text>
          <AppButton
            label="View requests"
            variant="outline"
            fullWidth={false}
            onPress={() => router.push("/(customer)/(tabs)/requests")}
          />
        </PanelCard>
      </View>

      <PanelCard style={styles.actionCard}>
        <Text style={styles.actionTitle}>Need to find a service?</Text>
        <Text style={styles.actionText}>
          Browse categories and start a new request from the public service catalog.
        </Text>
        <AppButton
          label="Browse categories"
          onPress={() => router.push("/(public)/(tabs)/categories")}
        />
      </PanelCard>

      <PanelCard style={styles.actionCard}>
        <Text style={styles.actionTitle}>Sign out</Text>
        <Text style={styles.actionText}>
          Logging out will clear your session on this device.
        </Text>
        <AppButton label="Logout" variant="secondary" onPress={handleLogout} />
      </PanelCard>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.white,
    fontSize: 22,
    fontWeight: "800",
  },
  profileTextBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  profileName: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "800",
  },
  profileMeta: {
    color: colors.muted,
    fontSize: 14,
  },
  quickGrid: {
    gap: spacing.md,
  },
  quickCard: {
    gap: spacing.sm,
  },
  quickLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  quickValue: {
    color: colors.foreground,
    fontSize: 15,
    lineHeight: 22,
  },
  actionCard: {
    gap: spacing.sm,
  },
  actionTitle: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "800",
  },
  actionText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
