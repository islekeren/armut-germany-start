import { useEffect, useState } from "react";
import {
  AlertBanner,
  AppButton,
  LoadingScreen,
  PageContainer,
  PanelCard,
  SectionHeader,
} from "@/components";
import { messagesApi, providerApi, type DashboardData } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/theme";
import { formatDayTime, formatRelativeAge, formatShortDate, StatusBadge } from "./shared";

const INITIAL_DATA: DashboardData = {
  stats: {
    newRequests: 0,
    activeOrders: 0,
    completed: 0,
    rating: 0,
  },
  recentRequests: [],
  activeBookings: [],
};

export function ProviderDashboardScreen() {
  const { accessToken, user } = useAuth();
  const [data, setData] = useState<DashboardData>(INITIAL_DATA);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      if (!accessToken) {
        setError("Missing provider session. Please log in again.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [dashboard, unread] = await Promise.all([
          providerApi.getDashboard(accessToken),
          messagesApi.getUnreadCount(accessToken),
        ]);

        if (!mounted) return;

        setData(dashboard);
        setUnreadCount(unread.unreadCount);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load provider dashboard.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      mounted = false;
    };
  }, [accessToken]);

  if (loading) {
    return <LoadingScreen label="Loading provider dashboard..." />;
  }

  const stats = [
    { label: "New requests", value: String(data.stats.newRequests), accent: colors.primary },
    { label: "Active jobs", value: String(data.stats.activeOrders), accent: colors.secondary },
    { label: "Completed", value: String(data.stats.completed), accent: colors.success },
    {
      label: "Rating",
      value: data.stats.rating ? data.stats.rating.toFixed(1) : "0.0",
      accent: colors.warning,
    },
  ];

  return (
    <PageContainer>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Provider dashboard</Text>
          <Text style={styles.title}>
            Welcome back, {user?.firstName || "Provider"}
          </Text>
          <Text style={styles.subtitle}>
            Your mobile overview of requests, bookings, and incoming messages.
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/(provider)/(tabs)/profile")}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>
            {(user?.firstName?.[0] || "P").toUpperCase()}
          </Text>
          {unreadCount > 0 ? <View style={styles.dot} /> : null}
        </Pressable>
      </View>

      {error ? <AlertBanner variant="warning">{error}</AlertBanner> : null}

      <PanelCard style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroLabel}>Unread messages</Text>
            <Text style={styles.heroValue}>{unreadCount}</Text>
          </View>
          <StatusBadge
            label={data.stats.rating ? "Top rated" : "Build momentum"}
            backgroundColor={data.stats.rating ? "#F0FDF4" : "#EFF6FF"}
            textColor={data.stats.rating ? "#15803D" : colors.primary}
          />
        </View>
        <Text style={styles.heroText}>
          Keep an eye on new requests and respond quickly to stay ahead of the queue.
        </Text>
        <AppButton
          label="Open requests"
          onPress={() => router.push("/(provider)/(tabs)/requests")}
          fullWidth={false}
          variant="outline"
        />
      </PanelCard>

      <View style={styles.statsGrid}>
        {stats.map((item) => (
          <PanelCard key={item.label} style={styles.statCard}>
            <View style={[styles.statAccent, { backgroundColor: item.accent }]} />
            <Text style={styles.statValue}>{item.value}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
          </PanelCard>
        ))}
      </View>

      <View style={styles.sectionHeaderRow}>
        <SectionHeader
          eyebrow="Incoming"
          title="Recent requests"
          subtitle="Fresh work items pulled from the provider dashboard API."
        />
        <AppButton
          label="See all"
          onPress={() => router.push("/(provider)/(tabs)/requests")}
          fullWidth={false}
          variant="ghost"
        />
      </View>

      <View style={styles.stack}>
        {data.recentRequests.length === 0 ? (
          <PanelCard>
            <Text style={styles.emptyTitle}>No new requests</Text>
            <Text style={styles.emptyText}>
              When new customer requests arrive, they will show up here first.
            </Text>
          </PanelCard>
        ) : (
          data.recentRequests.map((request) => (
            <PanelCard key={request.id} style={styles.listCard}>
              <View style={styles.listTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle}>{request.title}</Text>
                  <Text style={styles.listMeta}>
                    {request.category} • {request.location}
                  </Text>
                </View>
                <Text style={styles.listTime}>{formatRelativeAge(request.date)}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>Budget: {request.budget}</Text>
                <Text style={styles.metaText}>{formatShortDate(request.date)}</Text>
              </View>
            </PanelCard>
          ))
        )}
      </View>

      <View style={styles.sectionHeaderRow}>
        <SectionHeader
          eyebrow="Schedule"
          title="Upcoming bookings"
          subtitle="A quick view of what is already confirmed."
        />
        <AppButton
          label="Calendar"
          onPress={() => router.push("/(provider)/(tabs)/calendar")}
          fullWidth={false}
          variant="ghost"
        />
      </View>

      <View style={styles.stack}>
        {data.activeBookings.length === 0 ? (
          <PanelCard>
            <Text style={styles.emptyTitle}>No active bookings</Text>
            <Text style={styles.emptyText}>
              Confirmed jobs and their schedule will appear here once customers book.
            </Text>
          </PanelCard>
        ) : (
          data.activeBookings.map((booking) => (
            <PanelCard key={booking.id} style={styles.listCard}>
              <View style={styles.listTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle}>{booking.customer}</Text>
                  <Text style={styles.listMeta}>{booking.service}</Text>
                </View>
                <Text style={styles.listTime}>{booking.time}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>{formatDayTime(booking.date)}</Text>
                <Text style={styles.metaText}>{booking.status}</Text>
              </View>
            </PanelCard>
          ))
        )}
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.lg,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    color: colors.foreground,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
  },
  avatar: {
    width: 52,
    height: 52,
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
  dot: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 12,
    height: 12,
    borderRadius: radii.full,
    backgroundColor: colors.error,
    borderWidth: 2,
    borderColor: colors.white,
  },
  heroCard: {
    gap: spacing.md,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.lg,
  },
  heroLabel: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
  },
  heroValue: {
    color: colors.foreground,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    marginTop: 2,
  },
  heroText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  statCard: {
    flexBasis: "48%",
    gap: spacing.sm,
  },
  statAccent: {
    width: 36,
    height: 4,
    borderRadius: radii.full,
  },
  statValue: {
    color: colors.foreground,
    fontSize: 24,
    fontWeight: "800",
  },
  statLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  stack: {
    gap: spacing.md,
  },
  listCard: {
    gap: spacing.sm,
  },
  listTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  listTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "700",
  },
  listMeta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  listTime: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  metaText: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "600",
  },
  emptyTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "700",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
});
