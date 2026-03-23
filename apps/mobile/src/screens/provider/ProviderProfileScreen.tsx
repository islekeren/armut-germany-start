import { useEffect, useState } from "react";
import {
  AlertBanner,
  AppButton,
  FormInput,
  FormLabel,
  FormTextarea,
  LoadingScreen,
  PageContainer,
  PanelCard,
  SectionHeader,
} from "@/components";
import { providerApi, type ProviderProfile } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/theme";

const EMPTY_FORM_DATA = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  description: "",
  streetAddress: "",
  postalCode: "",
  city: "",
  serviceRadius: "25",
  priceMin: "",
  priceMax: "",
  experienceYears: "0",
  website: "",
};

function mapProfileToFormData(profile: ProviderProfile) {
  const firstService = profile.services[0];

  return {
    companyName: profile.companyName || "",
    contactName:
      `${profile.user.firstName} ${profile.user.lastName}`.trim() ||
      profile.user.firstName,
    email: profile.user.email,
    phone: profile.user.phone || "",
    description: profile.description,
    streetAddress: profile.profile?.addressLine1 || "",
    postalCode: profile.profile?.postalCode || "",
    city: profile.profile?.city || "",
    serviceRadius: String(profile.serviceAreaRadius || 25),
    priceMin: firstService?.priceMin != null ? String(firstService.priceMin) : "",
    priceMax: firstService?.priceMax != null ? String(firstService.priceMax) : "",
    experienceYears: String(profile.experienceYears || 0),
    website: profile.profile?.website || "",
  };
}

function splitContactName(contactName: string) {
  const trimmed = contactName.trim();
  if (!trimmed) {
    return { firstName: "", lastName: "" };
  }

  const [firstName, ...lastNameParts] = trimmed.split(/\s+/);
  return {
    firstName,
    lastName: lastNameParts.join(" "),
  };
}

export function ProviderProfileScreen() {
  const { accessToken, refreshAuth, user } = useAuth();
  const [formData, setFormData] = useState(EMPTY_FORM_DATA);
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      if (!accessToken) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setStatus("idle");

      try {
        const result = await providerApi.getProfile(accessToken);
        if (!mounted) return;

        setProfile(result);
        setFormData(mapProfileToFormData(result));
      } catch {
        if (!mounted) return;
        setStatus("error");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, [accessToken]);

  async function handleSave() {
    if (!accessToken) {
      setStatus("error");
      return;
    }

    setIsSaving(true);
    setStatus("idle");

    try {
      const { firstName, lastName } = splitContactName(formData.contactName);
      const updated = await providerApi.updateProfile(accessToken, {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        companyName: formData.companyName || undefined,
        description: formData.description,
        experienceYears: Number(formData.experienceYears) || 0,
        serviceAreaRadius: Number(formData.serviceRadius) || 25,
        serviceAreaLat: profile?.serviceAreaLat || 0,
        serviceAreaLng: profile?.serviceAreaLng || 0,
        priceMin: formData.priceMin ? Number(formData.priceMin) : undefined,
        priceMax: formData.priceMax ? Number(formData.priceMax) : undefined,
        addressLine1: formData.streetAddress || undefined,
        city: formData.city || undefined,
        postalCode: formData.postalCode || undefined,
        website: formData.website || undefined,
      });

      setProfile(updated);
      setFormData(mapProfileToFormData(updated));
      try {
        await refreshAuth();
      } catch {
        // Ignore refresh issues so the profile save can still succeed locally.
      }
      setStatus("success");
    } catch {
      setStatus("error");
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return <LoadingScreen label="Loading provider profile..." />;
  }

  return (
    <PageContainer>
      <SectionHeader
        eyebrow="Profile"
        title="Provider profile"
        subtitle="Update your company information and keep the mobile account in sync."
      />

      {status === "error" ? (
        <AlertBanner variant="error">We could not save or load your profile.</AlertBanner>
      ) : null}
      {status === "success" ? (
        <AlertBanner variant="success">Profile saved successfully.</AlertBanner>
      ) : null}

      <PanelCard style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.firstName?.[0] || profile?.user.firstName?.[0] || "P").toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryName}>
              {formData.companyName || profile?.companyName || "Your company"}
            </Text>
            <Text style={styles.summaryMeta}>
              {formData.city || profile?.profile?.city || "City not set"}
            </Text>
          </View>
        </View>

        <View style={styles.summaryBadges}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {(profile?.ratingAvg ?? 0).toFixed(1)} rating
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{profile?.totalReviews || 0} reviews</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{profile?.isApproved ? "Approved" : "Pending"}</Text>
          </View>
        </View>
      </PanelCard>

      <PanelCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Company info</Text>
        <View style={styles.fieldGroup}>
          <FormLabel>Company name</FormLabel>
          <FormInput
            value={formData.companyName}
            onChangeText={(companyName) => setFormData((current) => ({ ...current, companyName }))}
            placeholder="Your company"
          />
        </View>
        <View style={styles.fieldGroup}>
          <FormLabel>Contact name</FormLabel>
          <FormInput
            value={formData.contactName}
            onChangeText={(contactName) => setFormData((current) => ({ ...current, contactName }))}
            placeholder="First Last"
          />
        </View>
        <View style={styles.row}>
          <View style={styles.flexField}>
            <FormLabel>Email</FormLabel>
            <FormInput
              value={formData.email}
              onChangeText={(email) => setFormData((current) => ({ ...current, email }))}
              placeholder="you@example.com"
            />
          </View>
          <View style={styles.flexField}>
            <FormLabel>Phone</FormLabel>
            <FormInput
              value={formData.phone}
              onChangeText={(phone) => setFormData((current) => ({ ...current, phone }))}
              placeholder="+49..."
            />
          </View>
        </View>
        <View style={styles.fieldGroup}>
          <FormLabel>Description</FormLabel>
          <FormTextarea
            value={formData.description}
            onChangeText={(description) =>
              setFormData((current) => ({ ...current, description }))
            }
            placeholder="Tell customers about your work."
          />
        </View>
      </PanelCard>

      <PanelCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Service area and pricing</Text>
        <View style={styles.row}>
          <View style={styles.flexField}>
            <FormLabel>Street address</FormLabel>
            <FormInput
              value={formData.streetAddress}
              onChangeText={(streetAddress) =>
                setFormData((current) => ({ ...current, streetAddress }))
              }
              placeholder="Street, number"
            />
          </View>
          <View style={styles.flexField}>
            <FormLabel>City</FormLabel>
            <FormInput
              value={formData.city}
              onChangeText={(city) => setFormData((current) => ({ ...current, city }))}
              placeholder="Berlin"
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flexField}>
            <FormLabel>Postal code</FormLabel>
            <FormInput
              value={formData.postalCode}
              onChangeText={(postalCode) =>
                setFormData((current) => ({ ...current, postalCode }))
              }
              placeholder="10115"
            />
          </View>
          <View style={styles.flexField}>
            <FormLabel>Service radius</FormLabel>
            <FormInput
              value={formData.serviceRadius}
              onChangeText={(serviceRadius) =>
                setFormData((current) => ({ ...current, serviceRadius }))
              }
              placeholder="25"
              keyboardType="numeric"
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flexField}>
            <FormLabel>Min price</FormLabel>
            <FormInput
              value={formData.priceMin}
              onChangeText={(priceMin) => setFormData((current) => ({ ...current, priceMin }))}
              placeholder="100"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.flexField}>
            <FormLabel>Max price</FormLabel>
            <FormInput
              value={formData.priceMax}
              onChangeText={(priceMax) => setFormData((current) => ({ ...current, priceMax }))}
              placeholder="500"
              keyboardType="numeric"
            />
          </View>
        </View>
        <View style={styles.fieldGroup}>
          <FormLabel>Experience years</FormLabel>
          <FormInput
            value={formData.experienceYears}
            onChangeText={(experienceYears) =>
              setFormData((current) => ({ ...current, experienceYears }))
            }
            placeholder="5"
            keyboardType="numeric"
          />
        </View>
        <View style={styles.fieldGroup}>
          <FormLabel>Website</FormLabel>
          <FormInput
            value={formData.website}
            onChangeText={(website) => setFormData((current) => ({ ...current, website }))}
            placeholder="https://..."
          />
        </View>
      </PanelCard>

      <AppButton
        label={isSaving ? "Saving..." : "Save profile"}
        onPress={handleSave}
        disabled={isSaving}
      />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    gap: spacing.md,
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "800",
  },
  summaryName: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "800",
  },
  summaryMeta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  summaryBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  badge: {
    borderRadius: radii.full,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  sectionCard: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "800",
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  flexField: {
    flex: 1,
    gap: spacing.xs,
  },
});
