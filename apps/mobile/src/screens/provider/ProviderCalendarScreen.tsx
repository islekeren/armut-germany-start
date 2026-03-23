import { useEffect, useMemo, useState } from "react";
import { AppButton, LoadingScreen, PageContainer, PanelCard, SectionHeader } from "@/components";
import { providerApi, type ProviderBooking } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/theme";
import {
  buildTodayKey,
  formatDayTime,
  formatMoney,
  getDateKey,
  getMonthDays,
  StatusBadge,
} from "./shared";

export function ProviderCalendarScreen() {
  const { accessToken } = useAuth();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [bookings, setBookings] = useState<ProviderBooking[]>([]);
  const [selectedDate, setSelectedDate] = useState(buildTodayKey());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadBookings() {
      if (!accessToken) {
        setError("Missing provider session. Please log in again.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const month = currentDate.getMonth() + 1;
        const year = currentDate.getFullYear();
        const response = await providerApi.getBookings(accessToken, { month, year });

        if (!mounted) return;
        setBookings(response);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load bookings.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadBookings();

    return () => {
      mounted = false;
    };
  }, [accessToken, currentDate]);

  const days = useMemo(() => getMonthDays(currentDate), [currentDate]);
  const selectedEvents = bookings.filter((booking) => booking.scheduledDate.startsWith(selectedDate));
  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(currentDate);
  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const todayKey = buildTodayKey();

  if (loading) {
    return <LoadingScreen label="Loading provider calendar..." />;
  }

  return (
    <PageContainer>
      <View style={styles.header}>
        <SectionHeader
          eyebrow="Calendar"
          title="Upcoming jobs"
          subtitle="Scroll month by month and tap a day to inspect the schedule."
        />
        <AppButton
          label="Requests"
          onPress={() => router.push("/(provider)/(tabs)/requests")}
          fullWidth={false}
          variant="ghost"
        />
      </View>

      <View style={styles.toolbar}>
        <AppButton
          label="Previous"
          onPress={() =>
            setCurrentDate(
              (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1),
            )
          }
          fullWidth={false}
          variant="outline"
        />
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <AppButton
          label="Today"
          onPress={() => {
            const today = new Date();
            setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
            setSelectedDate(buildTodayKey());
          }}
          fullWidth={false}
          variant="outline"
        />
        <AppButton
          label="Next"
          onPress={() =>
            setCurrentDate(
              (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1),
            )
          }
          fullWidth={false}
          variant="outline"
        />
      </View>

      {error ? <PanelCard><Text style={styles.errorText}>{error}</Text></PanelCard> : null}

      <PanelCard style={styles.calendarCard}>
        <View style={styles.weekRow}>
          {daysOfWeek.map((day) => (
            <Text key={day} style={styles.weekLabel}>
              {day}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {days.map((day, index) => {
            if (!day) {
              return <View key={`empty-${index}`} style={styles.dayCellPlaceholder} />;
            }

            const dateKey = getDateKey(currentDate, day);
            const eventsForDay = bookings.filter((booking) =>
              booking.scheduledDate.startsWith(dateKey),
            );
            const isSelected = dateKey === selectedDate;
            const isToday = dateKey === todayKey;

            return (
              <Pressable
                key={dateKey}
                onPress={() => setSelectedDate(dateKey)}
                style={[
                  styles.dayCell,
                  isSelected ? styles.dayCellSelected : null,
                  isToday ? styles.dayCellToday : null,
                ]}
              >
                <Text style={[styles.dayNumber, isToday ? styles.dayNumberToday : null]}>
                  {day}
                </Text>
                {eventsForDay.slice(0, 2).map((booking) => (
                  <View key={booking.id} style={styles.eventDot}>
                    <Text style={styles.eventDotText} numberOfLines={1}>
                      {booking.time}
                    </Text>
                  </View>
                ))}
                {eventsForDay.length > 2 ? (
                  <Text style={styles.moreCount}>+{eventsForDay.length - 2}</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </PanelCard>

      <SectionHeader
        eyebrow="Selected day"
        title={new Intl.DateTimeFormat(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(new Date(selectedDate))}
        subtitle="Bookings scheduled for the highlighted date."
      />

      <View style={styles.stack}>
        {selectedEvents.length === 0 ? (
          <PanelCard>
            <Text style={styles.emptyTitle}>No bookings on this date</Text>
            <Text style={styles.emptyText}>
              Tap another day to inspect a different part of your month.
            </Text>
          </PanelCard>
        ) : (
          selectedEvents.map((booking) => (
            <PanelCard key={booking.id} style={styles.bookingCard}>
              <View style={styles.bookingTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bookingTitle}>{booking.title}</Text>
                  <Text style={styles.bookingMeta}>{booking.customer}</Text>
                </View>
                <StatusBadge
                  label={booking.status}
                  backgroundColor={
                    booking.status === "confirmed" ? "#F0FDF4" : "#FFFBEB"
                  }
                  textColor={
                    booking.status === "confirmed" ? "#15803D" : "#B45309"
                  }
                />
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailText}>{formatDayTime(booking.scheduledDate)}</Text>
                <Text style={styles.detailText}>{booking.address}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailText}>{formatMoney(booking.totalPrice)}</Text>
                <Text style={styles.detailText}>{booking.paymentStatus}</Text>
              </View>

              <View style={styles.actionsRow}>
                <AppButton
                  label="Calendar"
                  onPress={() => setCurrentDate(new Date(booking.scheduledDate))}
                  fullWidth={false}
                  variant="outline"
                />
                <AppButton
                  label="Requests"
                  onPress={() => router.push("/(provider)/(tabs)/requests")}
                  fullWidth={false}
                />
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
    gap: spacing.md,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  monthLabel: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "800",
    flexGrow: 1,
    textAlign: "center",
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: "600",
  },
  calendarCard: {
    gap: spacing.md,
  },
  weekRow: {
    flexDirection: "row",
  },
  weekLabel: {
    flex: 1,
    textAlign: "center",
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCellPlaceholder: {
    width: "14.2857%",
    aspectRatio: 0.95,
  },
  dayCell: {
    width: "14.2857%",
    aspectRatio: 0.95,
    padding: 4,
    borderRadius: radii.lg,
    gap: 3,
    borderWidth: 1,
    borderColor: "transparent",
  },
  dayCellSelected: {
    backgroundColor: "#F8FBFF",
    borderColor: colors.primary,
  },
  dayCellToday: {
    backgroundColor: "#FFF7ED",
  },
  dayNumber: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "700",
  },
  dayNumberToday: {
    color: colors.secondary,
  },
  eventDot: {
    backgroundColor: "#EFF6FF",
    borderRadius: radii.sm,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  eventDotText: {
    color: colors.primary,
    fontSize: 8,
    fontWeight: "700",
  },
  moreCount: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
  },
  stack: {
    gap: spacing.md,
  },
  bookingCard: {
    gap: spacing.sm,
  },
  bookingTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  bookingTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "800",
  },
  bookingMeta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  detailText: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "800",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
});
