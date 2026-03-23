import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, router, useLocalSearchParams } from "expo-router";
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

type RegisterSearchParams = {
  role?: "customer" | "provider";
};

export function RegisterScreen() {
  const { register, isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { role } = useLocalSearchParams<RegisterSearchParams>();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const initialRole = typeof role === "string" && role === "provider" ? "provider" : "customer";
  const [userType, setUserType] = useState<"customer" | "provider">(initialRole);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof role === "string" && (role === "provider" || role === "customer")) {
      setUserType(role);
    }
  }, [role]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !user) {
      return;
    }

    router.replace(user.userType === "provider" ? "/(provider)/(tabs)" : "/(customer)/(tabs)");
  }, [authLoading, isAuthenticated, user]);

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);

    try {
      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        userType,
        gdprConsent: acceptedTerms,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Registration failed. Please try again.");
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
            eyebrow="Join Armut"
            title="Create your account"
            subtitle="Choose whether you want to book services or offer them."
          />

          <PanelCard style={styles.heroCard}>
            <Text style={styles.heroTitle}>One app, two journeys</Text>
            <Text style={styles.heroCopy}>
              Customers can request help and track bookings. Providers can move into a native
              dashboard as soon as their account is created.
            </Text>
          </PanelCard>

          <PanelCard style={styles.roleCard}>
            <Text style={styles.roleLabel}>Account type</Text>
            <View style={styles.roleRow}>
              <RolePill
                active={userType === "customer"}
                label="Customer"
                onPress={() => setUserType("customer")}
                description="Book services"
              />
              <RolePill
                active={userType === "provider"}
                label="Provider"
                onPress={() => setUserType("provider")}
                description="Offer services"
              />
            </View>
          </PanelCard>

          {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}

          <PanelCard style={styles.formCard}>
            <View style={styles.row}>
              <View style={styles.field}>
                <FormLabel>First name</FormLabel>
                <FormInput placeholder="Anna" value={firstName} onChangeText={setFirstName} />
              </View>
              <View style={styles.field}>
                <FormLabel>Last name</FormLabel>
                <FormInput placeholder="Meyer" value={lastName} onChangeText={setLastName} />
              </View>
            </View>

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
              <FormLabel>Phone</FormLabel>
              <FormInput
                autoComplete="tel"
                keyboardType="phone-pad"
                placeholder="+49 ..."
                value={phone}
                onChangeText={setPhone}
              />
            </View>

            <View style={styles.field}>
              <FormLabel>Password</FormLabel>
              <View style={styles.passwordRow}>
                <FormInput
                  autoCapitalize="none"
                  autoComplete="password-new"
                  placeholder="At least 8 characters"
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

            <Pressable
              accessibilityRole="checkbox"
              onPress={() => setAcceptedTerms((value) => !value)}
              style={styles.consentRow}
            >
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                {acceptedTerms ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <Text style={styles.consentText}>
                I agree to the terms and GDPR consent required to create an account.
              </Text>
            </Pressable>

            <AppButton
              label={isSubmitting ? "Creating account..." : "Create account"}
              disabled={
                isSubmitting ||
                !firstName.trim() ||
                !lastName.trim() ||
                !email.trim() ||
                !password ||
                !acceptedTerms
              }
              onPress={handleSubmit}
            />

            <View style={styles.linksRow}>
              <Link href="/(auth)/login" style={styles.link}>
                Already have an account?
              </Link>
              <Link href="/(public)/(tabs)/profile" style={styles.linkSecondary}>
                Learn more about provider onboarding
              </Link>
            </View>
          </PanelCard>
        </View>
      </KeyboardAvoidingView>
    </PageContainer>
  );
}

function RolePill({
  label,
  description,
  active,
  onPress,
}: {
  label: string;
  description: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.rolePill,
        active && styles.rolePillActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.rolePillLabel, active && styles.rolePillLabelActive]}>{label}</Text>
      <Text style={[styles.rolePillDescription, active && styles.rolePillDescriptionActive]}>
        {description}
      </Text>
    </Pressable>
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
  roleCard: {
    gap: spacing.md,
  },
  roleLabel: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "700",
  },
  roleRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  rolePill: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    backgroundColor: colors.white,
    gap: 4,
  },
  rolePillActive: {
    borderColor: colors.primary,
    backgroundColor: "#EAF4FF",
  },
  rolePillLabel: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "800",
  },
  rolePillLabelActive: {
    color: colors.primary,
  },
  rolePillDescription: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
  },
  rolePillDescriptionActive: {
    color: colors.primaryDark,
  },
  formCard: {
    gap: spacing.lg,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  field: {
    gap: spacing.sm,
    flex: 1,
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
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    backgroundColor: colors.white,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxMark: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  consentText: {
    flex: 1,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
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
