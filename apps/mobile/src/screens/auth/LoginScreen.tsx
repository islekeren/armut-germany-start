import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { type Href, Link, router, useLocalSearchParams } from "expo-router";
import {
  AlertBanner,
  AppButton,
  FormInput,
  FormLabel,
  PageContainer,
  PanelCard,
  SectionHeader,
} from "@/components";
import { useAuth } from "@/providers/AuthProvider";
import { colors, radii, spacing, typography } from "@/theme";

type LoginSearchParams = {
  redirect?: string;
};

export function LoginScreen() {
  const { login, isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { redirect } = useLocalSearchParams<LoginSearchParams>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = typeof redirect === "string" && redirect.length > 0 ? redirect : null;

  useEffect(() => {
    if (authLoading || !isAuthenticated || !user) {
      return;
    }

    if (target) {
      router.replace(target as Href);
      return;
    }

    router.replace(user.userType === "provider" ? "/(provider)/(tabs)" : "/(customer)/(tabs)");
  }, [authLoading, isAuthenticated, target, user]);

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);

    try {
      await login({
        email: email.trim(),
        password,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Login failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.shell}>
          <SectionHeader
            eyebrow="Welcome back"
            title="Log in to your account"
            subtitle="Continue to your bookings, requests, and messages in the native app."
          />

          <PanelCard style={styles.heroCard}>
            <Text style={styles.heroTitle}>Fast sign-in, native flow</Text>
            <Text style={styles.heroCopy}>
              The mobile app keeps the same backend auth model as the web app, but the flow is
              tuned for one-handed use and quick navigation.
            </Text>
          </PanelCard>

          {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}

          <PanelCard style={styles.formCard}>
            <View style={styles.field}>
              <FormLabel>Email</FormLabel>
              <FormInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="ihre@email.de"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.field}>
              <FormLabel>Password</FormLabel>
              <View style={styles.passwordRow}>
                <FormInput
                  autoCapitalize="none"
                  autoComplete="password"
                  placeholder="••••••••"
                  secureTextEntry={!showPassword}
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowPassword((value) => !value)}
                  style={({ pressed }) => [styles.visibilityButton, pressed && styles.pressed]}
                >
                  <Text style={styles.visibilityText}>{showPassword ? "Hide" : "Show"}</Text>
                </Pressable>
              </View>
            </View>

            <AppButton
              label={isSubmitting ? "Signing in..." : "Log in"}
              disabled={isSubmitting || !email.trim() || !password}
              onPress={handleSubmit}
            />

            <View style={styles.linksRow}>
              <Link href="/(auth)/register" style={styles.link}>
                Create an account
              </Link>
              <Link href="/(public)/(tabs)/profile" style={styles.linkSecondary}>
                Explore as guest
              </Link>
            </View>
          </PanelCard>
        </View>
      </KeyboardAvoidingView>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  shell: {
    gap: spacing.lg,
  },
  heroCard: {
    gap: spacing.sm,
    backgroundColor: "#FFF7F0",
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
  formCard: {
    gap: spacing.lg,
  },
  field: {
    gap: spacing.sm,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing.sm,
  },
  passwordInput: {
    flex: 1,
  },
  visibilityButton: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    minWidth: 72,
  },
  visibilityText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.8,
  },
  linksRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  link: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  linkSecondary: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
  },
});
