import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  AlertBanner,
  FormInput,
  LoadingScreen,
  PageContainer,
  PanelCard,
  SectionHeader,
} from "@/components";
import {
  getCategories,
  isApiUnavailableError,
  providersApi,
  type Category,
  type PublicProvider,
} from "@/lib/api";
import { colors, radii, spacing, typography } from "@/theme";

export function CategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [providers, setProviders] = useState<PublicProvider[]>([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isProvidersLoading, setIsProvidersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await getCategories();

        if (!active) return;

        setCategories(result);
        setSelectedCategoryId((current) => current ?? result[0]?.id ?? null);
      } catch (cause) {
        if (!active) return;

        setError(isApiUnavailableError(cause) ? cause.message : "Unable to load categories.");
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadCategories();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedCategoryId) return;

    let active = true;

    async function loadProviders() {
      setIsProvidersLoading(true);

      try {
        const result = await providersApi.getAll({
          categoryId: selectedCategoryId ?? undefined,
          limit: 8,
        });

        if (!active) return;

        setProviders(result.data);
      } catch (cause) {
        if (!active) return;

        setError(isApiUnavailableError(cause) ? cause.message : "Unable to load providers.");
      } finally {
        if (active) {
          setIsProvidersLoading(false);
        }
      }
    }

    void loadProviders();

    return () => {
      active = false;
    };
  }, [selectedCategoryId]);

  const filteredCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();

    if (!query) return categories;

    return categories.filter((category) => {
      return (
        category.nameEn.toLowerCase().includes(query) ||
        category.nameDe.toLowerCase().includes(query) ||
        category.slug.toLowerCase().includes(query)
      );
    });
  }, [categories, categorySearch]);

  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? null;

  if (isLoading) {
    return <LoadingScreen label="Loading categories..." />;
  }

  return (
    <PageContainer>
      <SectionHeader
        eyebrow="Browse"
        title="Categories"
        subtitle="Find the service you need, then jump into a provider list optimized for mobile."
      />

      {error ? <AlertBanner variant="warning">{error}</AlertBanner> : null}

      <PanelCard style={styles.searchCard}>
        <Text style={styles.searchLabel}>Search categories</Text>
        <FormInput
          placeholder="Search cleaning, moving, repair..."
          value={categorySearch}
          onChangeText={setCategorySearch}
        />
      </PanelCard>

      <View style={styles.grid}>
        {filteredCategories.map((category) => {
          const active = category.id === selectedCategoryId;

          return (
            <Pressable
              key={category.id}
              accessibilityRole="button"
              onPress={() => setSelectedCategoryId(category.id)}
              style={({ pressed }) => [
                styles.categoryCard,
                active && styles.categoryCardActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.categoryIcon}>{category.icon}</Text>
              <Text style={[styles.categoryName, active && styles.categoryNameActive]} numberOfLines={1}>
                {category.nameEn}
              </Text>
              <Text style={styles.categorySlug} numberOfLines={2}>
                {category.slug}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedCategory ? (
        <PanelCard style={styles.featureCard}>
          <Text style={styles.featureEyebrow}>Selected category</Text>
          <Text style={styles.featureTitle}>{selectedCategory.nameEn}</Text>
          <Text style={styles.featureCopy}>
            Discover providers who match this service area. The list below updates from the same
            backend the web app uses.
          </Text>
        </PanelCard>
      ) : null}

      <View style={styles.sectionRow}>
        <SectionHeader
          eyebrow="Providers"
          title="Matching pros"
          subtitle="Native provider cards with ratings, review counts, and quick context."
        />
      </View>

      {isProvidersLoading ? (
        <PanelCard>
          <Text style={styles.loadingText}>Loading matching providers...</Text>
        </PanelCard>
      ) : (
        <View style={styles.providerList}>
          {providers.map((provider) => (
            <PanelCard key={provider.id} style={styles.providerCard}>
              <View style={styles.providerHeader}>
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
                  <Text style={styles.providerDescription} numberOfLines={3}>
                    {provider.profile?.headline || provider.description}
                  </Text>
                </View>
                <View style={styles.ratingBadge}>
                  <Text style={styles.ratingValue}>{provider.ratingAvg.toFixed(1)}</Text>
                </View>
              </View>

              <View style={styles.providerMetaRow}>
                <MetaPill label={`${provider.totalReviews} reviews`} />
                <MetaPill label={`${provider.experienceYears} yrs`} />
                <MetaPill label={provider.isApproved ? "Verified" : "Pending"} />
              </View>
            </PanelCard>
          ))}

          {providers.length === 0 ? (
            <PanelCard>
              <Text style={styles.emptyTitle}>No providers found</Text>
              <Text style={styles.emptyCopy}>
                Try another category or expand the search term to explore more service types.
              </Text>
            </PanelCard>
          ) : null}
        </View>
      )}
    </PageContainer>
  );
}

function MetaPill({ label }: { label: string }) {
  return (
    <View style={styles.metaPill}>
      <Text style={styles.metaPillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  searchCard: {
    gap: spacing.sm,
  },
  searchLabel: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "700",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  categoryCard: {
    width: "48%",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  categoryCardActive: {
    borderColor: colors.primary,
    backgroundColor: "#EAF4FF",
  },
  pressed: {
    opacity: 0.85,
  },
  categoryIcon: {
    fontSize: 30,
  },
  categoryName: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "800",
  },
  categoryNameActive: {
    color: colors.primary,
  },
  categorySlug: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  featureCard: {
    gap: spacing.sm,
    backgroundColor: "#FFF7F0",
  },
  featureEyebrow: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  featureTitle: {
    color: colors.foreground,
    fontSize: typography.subtitle,
    fontWeight: "800",
  },
  featureCopy: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  sectionRow: {
    marginTop: spacing.xs,
  },
  providerList: {
    gap: spacing.md,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
  },
  providerCard: {
    gap: spacing.md,
  },
  providerHeader: {
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
  providerDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  ratingBadge: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: radii.lg,
    backgroundColor: "#FFF7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  ratingValue: {
    color: colors.secondary,
    fontSize: 16,
    fontWeight: "900",
  },
  providerMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metaPill: {
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    backgroundColor: "#EEF6FF",
  },
  metaPillText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "700",
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
    marginTop: 6,
  },
});
