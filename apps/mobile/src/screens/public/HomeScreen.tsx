import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, router } from "expo-router";
import {
  AlertBanner,
  AppButton,
  LoadingScreen,
  PageContainer,
  PanelCard,
  SectionHeader,
} from "@/components";
import { getCategories, isApiUnavailableError, providersApi, type Category, type PublicProvider } from "@/lib/api";
import { colors, radii, spacing, typography } from "@/theme";

export function HomeScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [providers, setProviders] = useState<PublicProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProvidersLoading, setIsProvidersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setIsProvidersLoading(true);
      setError(null);

      try {
        const [categoryResult, providerResult] = await Promise.all([
          getCategories(),
          providersApi.getAll({ limit: 4 }),
        ]);

        if (!active) return;

        setCategories(categoryResult.slice(0, 6));
        setProviders(providerResult.data.slice(0, 4));
      } catch (cause) {
        if (!active) return;

        if (isApiUnavailableError(cause)) {
          setError(cause.message);
        } else {
          setError("Unable to load content right now.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
          setIsProvidersLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  if (isLoading) {
    return <LoadingScreen label="Loading your home feed..." />;
  }

  return (
    <PageContainer>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Armut Germany</Text>
        <Text style={styles.title}>Find trusted local help from your phone.</Text>
        <Text style={styles.subtitle}>
          Search, browse, and contact service providers with a mobile-first experience that still
          connects directly to the monorepo API.
        </Text>

        <View style={styles.heroActions}>
          <AppButton label="Browse categories" onPress={() => router.push("/(public)/(tabs)/categories")} />
          <Link href="/(auth)/register" style={styles.inlineLink}>
            Join as provider
          </Link>
        </View>
      </View>

      {error ? <AlertBanner variant="warning">{error}</AlertBanner> : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/(public)/(tabs)/categories")}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <PanelCard style={styles.searchCard}>
          <Text style={styles.sectionLabel}>Search</Text>
          <Text style={styles.searchTitle}>What do you need help with?</Text>
          <View style={styles.searchInput}>
            <Text style={styles.searchPlaceholder}>Try cleaning, moving, plumbing...</Text>
          </View>
          <View style={styles.searchMetaRow}>
            <MetaChip label="Fast quotes" />
            <MetaChip label="Verified pros" />
            <MetaChip label="Mobile chat" />
          </View>
        </PanelCard>
      </Pressable>

      <View style={styles.sectionHeaderRow}>
        <SectionHeader
          eyebrow="Categories"
          title="Popular services"
          subtitle="Start with a common job and jump straight into providers."
        />
        <Link href="/(public)/(tabs)/categories" style={styles.seeAllLink}>
          See all
        </Link>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
        {categories.map((category) => (
          <Pressable
            key={category.id}
            accessibilityRole="button"
            onPress={() => router.push("/(public)/(tabs)/categories")}
            style={({ pressed }) => [styles.categoryCard, pressed && styles.pressed]}
          >
            <Text style={styles.categoryIcon}>{category.icon}</Text>
            <Text style={styles.categoryTitle} numberOfLines={1}>
              {category.nameEn}
            </Text>
            <Text style={styles.categorySubtitle} numberOfLines={2}>
              Browse local providers
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.sectionHeaderRow}>
        <SectionHeader
          eyebrow="Featured"
          title="Nearby providers"
          subtitle="A native card feed that mirrors the web provider browsing pages."
        />
      </View>

      <View style={styles.providerList}>
        {isProvidersLoading ? (
          <PanelCard style={styles.loadingCard}>
            <Text style={styles.loadingText}>Loading providers...</Text>
          </PanelCard>
        ) : (
          <>
            {providers.map((provider) => (
              <PanelCard key={provider.id} style={styles.providerCard}>
              <View style={styles.providerTopRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {provider.user.firstName.charAt(0)}
                    {provider.user.lastName.charAt(0)}
                  </Text>
                </View>
                <View style={styles.providerMain}>
                  <Text style={styles.providerName}>
                    {provider.companyName || `${provider.user.firstName} ${provider.user.lastName}`}
                  </Text>
                  <Text style={styles.providerHeadline} numberOfLines={2}>
                    {provider.profile?.headline || provider.description}
                  </Text>
                </View>
                <View style={styles.ratingPill}>
                  <Text style={styles.ratingValue}>{provider.ratingAvg.toFixed(1)}</Text>
                  <Text style={styles.ratingLabel}>stars</Text>
                </View>
              </View>

              <View style={styles.providerMetaRow}>
                <MetaChip label={`${provider.totalReviews} reviews`} />
                <MetaChip label={`${provider.experienceYears} years`} />
                <MetaChip label={provider.isApproved ? "Verified" : "Pending"} />
              </View>
              </PanelCard>
            ))}

            {providers.length === 0 ? (
              <PanelCard style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No providers yet</Text>
                <Text style={styles.emptyCopy}>
                  Try another search or open categories to explore more services.
                </Text>
              </PanelCard>
            ) : null}
          </>
        )}
      </View>
    </PageContainer>
  );
}

function MetaChip({ label }: { label: string }) {
  return (
    <View style={styles.metaChip}>
      <Text style={styles.metaChipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  kicker: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: colors.foreground,
    fontSize: 32,
    fontWeight: "900",
    lineHeight: 38,
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 24,
  },
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flexWrap: "wrap",
    marginTop: spacing.sm,
  },
  inlineLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  searchCard: {
    gap: spacing.sm,
    backgroundColor: "#FFF7F0",
  },
  emptyCard: {
    gap: spacing.xs,
  },
  emptyTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "800",
  },
  emptyCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  searchTitle: {
    color: colors.foreground,
    fontSize: typography.subtitle,
    fontWeight: "800",
  },
  searchInput: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  searchPlaceholder: {
    color: colors.muted,
    fontSize: 15,
  },
  searchMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metaChip: {
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    backgroundColor: "#EEF6FF",
  },
  metaChipText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "700",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  seeAllLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  horizontalList: {
    gap: spacing.md,
    paddingRight: spacing.lg,
  },
  categoryCard: {
    width: 150,
    borderRadius: radii.xl,
    backgroundColor: colors.white,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.85,
  },
  categoryIcon: {
    fontSize: 28,
  },
  categoryTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "800",
  },
  categorySubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  providerList: {
    gap: spacing.md,
  },
  loadingCard: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 96,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
  },
  providerCard: {
    gap: spacing.md,
  },
  providerTopRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#EAF4FF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "900",
  },
  providerMain: {
    flex: 1,
    gap: 4,
  },
  providerName: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "800",
  },
  providerHeadline: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  ratingPill: {
    minWidth: 54,
    borderRadius: radii.lg,
    backgroundColor: "#FFF7EB",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  ratingValue: {
    color: colors.secondary,
    fontSize: 16,
    fontWeight: "900",
  },
  ratingLabel: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: "700",
  },
  providerMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
