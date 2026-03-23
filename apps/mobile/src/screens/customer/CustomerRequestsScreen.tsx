import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { AlertBanner, AppButton, LoadingScreen, PageContainer, PanelCard, SectionHeader } from "@/components";
import { useAuth } from "@/providers/AuthProvider";
import { bookingsApi, quotesApi, requestsApi, type CustomerBooking, type Quote, type ServiceRequest } from "@/lib/api";
import { colors, radii, spacing } from "@/theme";
import { StatusPill } from "./StatusPill";
import { requestStatusMap, transformRequest } from "./helpers";

type DisplayRequestFilter = "all" | "active" | "booked" | "completed" | "cancelled";

export function CustomerRequestsScreen() {
  const { accessToken } = useAuth();
  const [filter, setFilter] = useState<DisplayRequestFilter>("all");
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadRequests() {
      if (!accessToken) {
        setError("Please log in to view your requests.");
        setIsLoading(false);
        return;
      }

      try {
        setError(null);
        const [requestData, bookingData, quoteData] = await Promise.all([
          requestsApi.getMyRequests(accessToken),
          bookingsApi.getCustomerBookings(accessToken, { page: 1, limit: 100 }),
          quotesApi.getMyQuotes(accessToken),
        ]);

        if (!isMounted) return;

        setRequests(requestData);
        setBookings(bookingData.data);
        setQuotes(quoteData);
      } catch (loadError) {
        if (!isMounted) return;
        console.error("Failed to load customer requests:", loadError);
        setError(loadError instanceof Error ? loadError.message : "Failed to load requests");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadRequests();

    return () => {
      isMounted = false;
    };
  }, [accessToken]);

  const bookingsByRequestId = useMemo(() => {
    const map = new Map<string, CustomerBooking>();

    bookings.forEach((booking) => {
      const requestId = booking.quote?.request?.id;
      if (requestId) {
        map.set(requestId, booking);
      }
    });

    return map;
  }, [bookings]);

  const acceptedQuotesByRequestId = useMemo(() => {
    const map = new Map<string, Quote>();

    quotes
      .filter((quote) => quote.status === "accepted" && quote.request?.id)
      .forEach((quote) => {
        if (quote.request?.id) {
          map.set(quote.request.id, quote);
        }
      });

    return map;
  }, [quotes]);

  const transformedRequests = useMemo(
    () =>
      requests.map((request) =>
        transformRequest(request, {
          bookingsByRequestId,
          acceptedQuotesByRequestId,
        }),
      ),
    [acceptedQuotesByRequestId, bookingsByRequestId, requests],
  );

  const filteredRequests = useMemo(() => {
    if (filter === "all") return transformedRequests;
    return transformedRequests.filter((request) => request.status === filter);
  }, [filter, transformedRequests]);

  if (isLoading) {
    return <LoadingScreen label="Loading your requests..." />;
  }

  return (
    <PageContainer>
      <SectionHeader
        eyebrow="Customer"
        title="My requests"
        subtitle="Follow each request from creation to booking and completion."
      />

      {error ? <AlertBanner>{error}</AlertBanner> : null}

      <View style={styles.actionsRow}>
        <AppButton
          label="Browse services"
          fullWidth={false}
          onPress={() => router.push("/(public)/(tabs)/categories")}
        />
        <AppButton
          label="Open bookings"
          variant="outline"
          fullWidth={false}
          onPress={() => router.push("/(customer)/(tabs)/bookings")}
        />
      </View>

      <View style={styles.filterRow}>
        {(["all", "active", "booked", "completed", "cancelled"] as DisplayRequestFilter[]).map((item) => (
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
        {filteredRequests.length > 0 ? (
          filteredRequests.map((request) => (
            <Pressable
              key={request.id}
              onPress={() => router.push({ pathname: "/(customer)/requests/[id]", params: { id: request.id } })}
              style={({ pressed }) => [styles.cardWrap, pressed && styles.pressed]}
            >
              <PanelCard style={styles.card}>
                <View style={styles.rowBetween}>
                  <StatusPill
                    label={requestStatusMap[request.status].label}
                    backgroundColor={requestStatusMap[request.status].background}
                    textColor={requestStatusMap[request.status].text}
                  />
                  <Text style={styles.meta}>{request.quotes} quotes</Text>
                </View>
                <Text style={styles.title}>{request.title}</Text>
                <Text style={styles.description}>{request.description}</Text>
                <Text style={styles.meta}>
                  {request.category} · {request.location}
                </Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Created</Text>
                  <Text style={styles.detailValue}>{request.createdAt}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Budget</Text>
                  <Text style={styles.detailValue}>{request.budget}</Text>
                </View>
              </PanelCard>
            </Pressable>
          ))
        ) : (
          <PanelCard style={styles.emptyCard}>
            <Text style={styles.title}>No matching requests</Text>
            <Text style={styles.description}>
              Try a different filter or browse services to start a new request.
            </Text>
          </PanelCard>
        )}
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
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
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    color: colors.foreground,
    fontSize: 18,
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
  },
  emptyCard: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.75,
  },
});
