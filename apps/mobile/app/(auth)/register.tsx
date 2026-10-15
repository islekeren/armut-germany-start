import { Link, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getDefaultWebPath,
  getProviderOnboardingPath,
  getSingleParam,
} from "../../src/lib/routing";
import { useSession } from "../../src/providers/SessionProvider";

type UserType = "customer" | "provider";

export default function RegisterScreen() {
  const params = useLocalSearchParams<{ redirect?: string }>();
  const { registerAccount } = useSession();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [gdprConsent, setGdprConsent] = useState(false);
  const [userType, setUserType] = useState<UserType>("customer");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirect = getSingleParam(params.redirect);

  async function handleSubmit() {
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!gdprConsent) {
      setError("Please accept the privacy and terms consent to continue.");
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await registerAccount({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        gdprConsent,
        userType,
      });

      const targetPath =
        userType === "provider"
          ? getProviderOnboardingPath()
          : redirect || getDefaultWebPath(session.user.userType);

      router.replace({
        pathname: "/(app)/web",
        params: { path: targetPath },
      });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "We could not create your account.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.brand}>Armut Germany</Text>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>
              Expo handles account creation and routing. Providers finish their
              public profile inside the embedded web app right after signup.
            </Text>

            <View style={styles.segmentRow}>
              <Pressable
                onPress={() => setUserType("customer")}
                style={[
                  styles.segment,
                  userType === "customer" && styles.segmentActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentTitle,
                    userType === "customer" && styles.segmentTitleActive,
                  ]}
                >
                  Customer
                </Text>
                <Text style={styles.segmentText}>Book services and manage requests.</Text>
              </Pressable>

              <Pressable
                onPress={() => setUserType("provider")}
                style={[
                  styles.segment,
                  userType === "provider" && styles.segmentActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentTitle,
                    userType === "provider" && styles.segmentTitleActive,
                  ]}
                >
                  Provider
                </Text>
                <Text style={styles.segmentText}>Set up your pro profile after signup.</Text>
              </Pressable>
            </View>

            <View style={styles.row}>
              <View style={[styles.fieldGroup, styles.half]}>
                <Text style={styles.label}>First name</Text>
                <TextInput
                  onChangeText={setFirstName}
                  placeholder="Anna"
                  style={styles.input}
                  value={firstName}
                />
              </View>

              <View style={[styles.fieldGroup, styles.half]}>
                <Text style={styles.label}>Last name</Text>
                <TextInput
                  onChangeText={setLastName}
                  placeholder="Schmidt"
                  style={styles.input}
                  value={lastName}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="you@example.com"
                style={styles.input}
                value={email}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                autoCapitalize="none"
                secureTextEntry
                onChangeText={setPassword}
                placeholder="Minimum 8 characters"
                style={styles.input}
                value={password}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm password</Text>
              <TextInput
                autoCapitalize="none"
                secureTextEntry
                onChangeText={setConfirmPassword}
                placeholder="Repeat password"
                style={styles.input}
                value={confirmPassword}
              />
            </View>

            <Pressable
              onPress={() => setGdprConsent((value) => !value)}
              style={styles.checkboxRow}
            >
              <View style={[styles.checkbox, gdprConsent && styles.checkboxChecked]}>
                {gdprConsent ? <Text style={styles.checkboxTick}>✓</Text> : null}
              </View>
              <Text style={styles.checkboxText}>
                I agree to the privacy policy and terms.
              </Text>
            </Pressable>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              disabled={isSubmitting}
              onPress={handleSubmit}
              style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Create account</Text>
              )}
            </Pressable>

            <Link
              href={{
                pathname: "/(auth)/login",
                params: redirect ? { redirect } : undefined,
              }}
              style={styles.link}
            >
              Already have an account?
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5efe7",
  },
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    gap: 16,
    padding: 24,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  brand: {
    color: "#c75c2a",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  title: {
    color: "#1e1a18",
    fontSize: 30,
    fontWeight: "700",
  },
  subtitle: {
    color: "#6b5d55",
    fontSize: 15,
    lineHeight: 22,
  },
  segmentRow: {
    gap: 12,
  },
  segment: {
    borderColor: "#d8c8bd",
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  segmentActive: {
    borderColor: "#c75c2a",
    backgroundColor: "#fcf2ec",
  },
  segmentTitle: {
    color: "#1e1a18",
    fontSize: 16,
    fontWeight: "700",
  },
  segmentTitleActive: {
    color: "#9c3f16",
  },
  segmentText: {
    color: "#6b5d55",
    fontSize: 13,
    lineHeight: 18,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  half: {
    flex: 1,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    color: "#3f342f",
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    borderColor: "#d8c8bd",
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  checkboxRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  checkbox: {
    alignItems: "center",
    borderColor: "#d8c8bd",
    borderRadius: 6,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  checkboxChecked: {
    backgroundColor: "#1e1a18",
    borderColor: "#1e1a18",
  },
  checkboxTick: {
    color: "#ffffff",
    fontWeight: "700",
  },
  checkboxText: {
    color: "#3f342f",
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  error: {
    color: "#c43d31",
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#1e1a18",
    borderRadius: 16,
    minHeight: 52,
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  link: {
    color: "#c75c2a",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
});
