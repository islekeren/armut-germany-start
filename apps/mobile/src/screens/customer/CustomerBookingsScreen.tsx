import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { AlertBanner, AppButton, LoadingScreen, PageContainer, PanelCard, SectionHeader } from "@/components";
import { useAuth } from "@/providers/AuthProvider";
import { bookingsApi, type CustomerBooking } from "@/lib/api";
import { colors, radii, spacing } from "@/theme";
import { StatusPill } from "./StatusPill";
import { bookingStatusMap, formatCurrency, transformBooking } from "./helpers";

type BookingFilter = "all" | "upcoming" | "completed" | "cancelled";

export function CustomerBookingsScreen() {
  const { accessToken } = useAuth();
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [filter, setFilter] = useState<BookingFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadBookings() {
      if (!accessToken) {
        setError("Please log in to view your bookings.");
        setIsLoading(false);
        return;
      }

      try {
        setError(null);
        const result = await bookingsApi.getCustomerBookings(accessToken, { page: 1, limit: 100 });
        if (!isMounted) return;
        setBookings(result.data);
      } catch (loadError) {
        if (!isMounted) return;
        console.error("Failed to load bookings:", loadError);
        setError(loadError instanceof Error ? loadError.message : "Failed to load bookings");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadBookings();

    return () => {
      isMounted = false;
    };
  }, [accessToken]);

  const nextBooking = useMemo(
    () =>
      bookings.find((booking) => ["pending", "confirmed", "in_progress"].includes(booking.status)) ||
      bookings[0] ||
      null,
    [bookings],
  );

  const filteredBookings = useMemo(() => {
    if (filter === "all") return bookings;
    if (filter === "upcoming") {
      return bookings.filter((booking) => ["pending", "confirmed", "in_progress"].includes(booking.status));
    }
    return bookings.filter((booking) => booking.status === filter);
  }, [bookings, filter]);

  if (isLoading) {
    return <LoadingScreen label="Loading your bookings..." />;
  }

  return (
    <PageContainer>
      <SectionHeader
        eyebrow="Customer"
        title="Bookings"
        subtitle="Track upcoming appointments, completed work, and payment status."
      />

      {error ? <AlertBanner>{error}</AlertBanner> : null}

      {nextBooking ? (
        <PanelCard style={styles.highlightCard}>
          <Text style={styles.sectionLabel}>Next booking</Text>
          <View style={styles.rowBetween}>
            <View style={styles.highlightTextBlock}>
              <Text style={styles.highlightTitle}>{transformBooking(nextBooking).title}</Text>
              <Text style={styles.highlightMeta}>{transformBooking(nextBooking).provider}</Text>
            </View>
            <StatusPill
              label={bookingStatusMap[nextBooking.status].label}
              backgroundColor={bookingStatusMap[nextBooking.status].background}
              textColor={bookingStatusMap[nextBooking.status].text}
            />
          </View>
          <Text style={styles.highlightMeta}>{transformBooking(nextBooking).scheduledDate}</Text>
          <Text style={styles.highlightMeta}>{formatCurrency(nextBooking.totalPrice)}</Text>
          <View style={styles.actionRow}>
            <AppButton
              label="View details"
              fullWidth={false}
              onPress={() => router.push({ pathname: "/(customer)/bookings/[id]", params: { id: nextBooking.id } })}
            />
            <AppButton
              label="Open requests"
              variant="outline"
              fullWidth={false}
              onPress={() => router.push("/(customer)/(tabs)/requests")}
            />
          </View>
        </PanelCard>
      ) : (
        <PanelCard style={styles.highlightCard}>
          <Text style={styles.sectionLabel}>Next booking</Text>
          <Text style={styles.highlightTitle}>No upcoming bookings</Text>
          <Text style={styles.highlightMeta}>Your future appointments will appear here.</Text>
        </PanelCard>
      )}

      <View style={styles.filterRow}>
        {(["all", "upcoming", "completed", "cancelled"] as BookingFilter[]).map((item) => (
          <Pressable
            key={item}
            onPress={() => setFilter(item)}
            style={({ pressed }) => [
              styles.filterChip,
              filter === item && styles.filterChipActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>
              {item === "all" ? "All" : item.charAt(0).toUpperCase() + item.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.list}>
        {filteredBookings.length > 0 ? (
          filteredBookings.map((booking) => {
            const viewModel = transformBooking(booking);
            return (
              <Pressable
                key={booking.id}
                onPress={() => router.push({ pathname: "/(customer)/bookings/[id]", params: { id: booking.id } })}
                style={({ pressed }) => [styles.cardWrap, pressed && styles.pressed]}
              >
                <PanelCard style={styles.card}>
                  <View style={styles.rowBetween}>
                    <StatusPill
                      label={bookingStatusMap[booking.status].label}
                      backgroundColor={bookingStatusMap[booking.status].background}
                      textColor={bookingStatusMap[booking.status].text}
                    />
                    <Text style={styles.meta}>{booking.paymentStatus}</Text>
                  </View>
                  <Text style={styles.title}>{viewModel.title}</Text>
                  <Text style={styles.description}>{viewModel.provider}</Text>
                  <Text style={styles.meta}>{viewModel.scheduledDate}</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Location</Text>
                    <Text style={styles.detailValue}>{viewModel.location}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Price</Text>
                    <Text style={styles.detailValue}>{formatCurrency(booking.totalPrice)}</Text>
                  </View>
                </PanelCard>
              </Pressable>
            );
          })
        ) : (
          <PanelCard style={styles.card}>
            <Text style={styles.title}>No bookings in this filter</Text>
            <Text style={styles.description}>Try another tab or wait for a quote to become a booking.</Text>
          </PanelCard>
        )}
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  highlightCard: {
    gap: spacing.sm,
  },
  sectionLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  highlightTextBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  highlightTitle: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: "800",
  },
  highlightMeta: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "700",
  },
  filterTextActive: {
    color: colors.white,
  },
  list: {
    gap: spacing.md,
  },
  cardWrap: {
    borderRadius: radii.xl,
  },
  card: {
    gap: spacing.sm,
  },
  title: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "800",
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 12,
    textTransform: "uppercase",
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  detailValue: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  pressed: {
    opacity: 0.75,
  },
});
