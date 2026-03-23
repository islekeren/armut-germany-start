import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import {
  AlertBanner,
  AppButton,
  LoadingScreen,
  PageContainer,
  PanelCard,
  SectionHeader,
} from "@/components";
import { useAuth } from "@/providers/AuthProvider";
import { bookingsApi, getCategories, messagesApi, requestsApi, type Category, type CustomerBooking, type ServiceRequest } from "@/lib/api";
import { colors, radii, spacing, typography } from "@/theme";
import { StatusPill } from "./StatusPill";
import {
  bookingStatusMap,
  formatCurrency,
  requestStatusMap,
  transformBooking,
  transformRequest,
} from "./helpers";

export function CustomerHomeScreen() {
  const { user, accessToken } = useAuth();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      if (!accessToken) {
        setError("Please log in to view your customer dashboard.");
        setIsLoading(false);
        return;
      }

      try {
        setError(null);
        const [myRequests, allBookings, categoryList, unread] = await Promise.all([
          requestsApi.getMyRequests(accessToken),
          bookingsApi.getUpcomingCustomer(accessToken),
          getCategories(),
          messagesApi.getUnreadCount(accessToken),
        ]);

        if (!isMounted) return;

        setRequests(myRequests);
        setBookings(allBookings);
        setCategories(categoryList.slice(0, 6));
        setUnreadCount(unread.unreadCount);
      } catch (loadError) {
        if (!isMounted) return;
        console.error("Failed to load customer home:", loadError);
        setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [accessToken]);

  const recentRequests = useMemo(
    () =>
      requests
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 3),
    [requests],
  );

  const upcomingBooking = bookings[0] || null;
  const totalRequests = requests.length;

  if (isLoading) {
    return <LoadingScreen label="Loading your customer dashboard..." />;
  }

  return (
    <PageContainer>
      <SectionHeader
        eyebrow="Customer"
        title={`Hello, ${user?.firstName || "there"}`}
        subtitle="Track requests, bookings, and messages from one native dashboard."
      />

      {error ? <AlertBanner>{error}</AlertBanner> : null}

      <View style={styles.summaryRow}>
        <PanelCard style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{totalRequests}</Text>
          <Text style={styles.summaryLabel}>Requests</Text>
        </PanelCard>
        <PanelCard style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{bookings.length}</Text>
          <Text style={styles.summaryLabel}>Bookings</Text>
        </PanelCard>
        <PanelCard style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{unreadCount}</Text>
          <Text style={styles.summaryLabel}>Unread</Text>
        </PanelCard>
      </View>

      <PanelCard style={styles.heroCard}>
        <Text style={styles.heroTitle}>What would you like to do next?</Text>
        <Text style={styles.heroText}>
          Browse categories, check upcoming appointments, or jump back into a conversation.
        </Text>
        <View style={styles.heroActions}>
          <AppButton
            label="Browse services"
            fullWidth={false}
            onPress={() => router.push("/(public)/(tabs)/categories")}
          />
          <AppButton
            label="Open messages"
            variant="outline"
            fullWidth={false}
            onPress={() => router.push("/(customer)/(tabs)/messages")}
          />
        </View>
      </PanelCard>

      {upcomingBooking ? (
        <PanelCard style={styles.featureCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Next booking</Text>
            <StatusPill
              label={bookingStatusMap[upcomingBooking.status].label}
              backgroundColor={bookingStatusMap[upcomingBooking.status].background}
              textColor={bookingStatusMap[upcomingBooking.status].text}
            />
          </View>
          <Text style={styles.featureTitle}>{transformBooking(upcomingBooking).title}</Text>
          <Text style={styles.featureText}>
            {transformBooking(upcomingBooking).provider}
          </Text>
          <Text style={styles.featureMeta}>
            {transformBooking(upcomingBooking).scheduledDate} · {formatCurrency(upcomingBooking.totalPrice)}
          </Text>
          <AppButton
            label="View booking"
            fullWidth={false}
            onPress={() => router.push({ pathname: "/(customer)/bookings/[id]", params: { id: upcomingBooking.id } })}
          />
        </PanelCard>
      ) : (
        <PanelCard style={styles.featureCard}>
          <Text style={styles.sectionTitle}>Next booking</Text>
          <Text style={styles.featureText}>No upcoming bookings yet.</Text>
        </PanelCard>
      )}

      <View style={styles.sectionSpacer}>
        <SectionHeader title="Recent requests" subtitle="The latest request activity from your account." />
      </View>

      <View style={styles.list}>
        {recentRequests.length > 0 ? (
          recentRequests.map((request) => {
            const mapped = transformRequest(request, {
              bookingsByRequestId: new Map(),
              acceptedQuotesByRequestId: new Map(),
            });

            return (
              <Pressable
                key={request.id}
                onPress={() => router.push({ pathname: "/(customer)/requests/[id]", params: { id: request.id } })}
                style={({ pressed }) => [styles.listCardWrap, pressed && styles.pressed]}
              >
                <PanelCard style={styles.listCard}>
                  <View style={styles.rowBetween}>
                    <StatusPill
                      label={requestStatusMap[mapped.status].label}
                      backgroundColor={requestStatusMap[mapped.status].background}
                      textColor={requestStatusMap[mapped.status].text}
                    />
                    <Text style={styles.cardMeta}>{mapped.quotes} quotes</Text>
                  </View>
                  <Text style={styles.cardTitle}>{mapped.title}</Text>
                  <Text style={styles.cardText}>{mapped.description}</Text>
                  <Text style={styles.cardMeta}>
                    {mapped.category} · {mapped.location}
                  </Text>
                </PanelCard>
              </Pressable>
            );
          })
        ) : (
          <PanelCard>
            <Text style={styles.cardTitle}>No requests yet</Text>
            <Text style={styles.cardText}>
              Start by browsing a category and creating your first service request.
            </Text>
          </PanelCard>
        )}
      </View>

      <View style={styles.sectionSpacer}>
        <SectionHeader title="Popular categories" subtitle="Jump back into the services you use most." />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        {categories.map((category) => (
          <Pressable
            key={category.id}
            onPress={() => router.push("/(public)/(tabs)/categories")}
            style={({ pressed }) => [styles.categoryCard, pressed && styles.pressed]}
          >
            <Text style={styles.categoryIcon}>{category.icon}</Text>
            <Text style={styles.categoryName}>{category.nameEn}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  summaryValue: {
    color: colors.foreground,
    fontSize: 24,
    fontWeight: "800",
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
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
    fontSize: 15,
    lineHeight: 22,
  },
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  featureCard: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "800",
  },
  featureTitle: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: "800",
  },
  featureText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  featureMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionSpacer: {
    marginTop: spacing.sm,
  },
  list: {
    gap: spacing.md,
  },
  listCardWrap: {
    borderRadius: radii.xl,
  },
  listCard: {
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "800",
  },
  cardText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  categoryRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  categoryCard: {
    width: 116,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  categoryIcon: {
    fontSize: 28,
  },
  categoryName: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.75,
  },
});
