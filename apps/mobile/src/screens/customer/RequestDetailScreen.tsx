import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { AlertBanner, AppButton, LoadingScreen, PageContainer, PanelCard, SectionHeader } from "@/components";
import { useAuth } from "@/providers/AuthProvider";
import { bookingsApi, messagesApi, quotesApi, requestsApi, type CustomerBooking, type Quote, type ServiceRequest } from "@/lib/api";
import { colors, radii, spacing } from "@/theme";
import { StatusPill } from "./StatusPill";
import { requestStatusMap, transformRequest } from "./helpers";

export function RequestDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const requestId = typeof params.id === "string" ? params.id : "";
  const { accessToken } = useAuth();

  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [booking, setBooking] = useState<CustomerBooking | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadRequest() {
      if (!requestId) {
        setError("Request not found.");
        setIsLoading(false);
        return;
      }

      try {
        setError(null);
        const apiRequest = await requestsApi.getById(requestId);
        if (!isMounted) return;

        setRequest(apiRequest);

        if (accessToken) {
          const [quoteData, bookingData] = await Promise.all([
            quotesApi.getByRequest(accessToken, requestId),
            bookingsApi.getCustomerBookings(accessToken, { page: 1, limit: 100 }),
          ]);

          if (!isMounted) return;

          setQuotes(quoteData);
          setBooking(
            bookingData.data.find((item) => item.quote?.request?.id === requestId) || null,
          );
          setSelectedQuoteId(quoteData[0]?.id || null);
        }
      } catch (loadError) {
        if (!isMounted) return;
        console.error("Failed to load request detail:", loadError);
        setError(loadError instanceof Error ? loadError.message : "Failed to load request");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadRequest();

    return () => {
      isMounted = false;
    };
  }, [accessToken, requestId]);

  const viewModel = useMemo(() => {
    if (!request) return null;
    return transformRequest(request, {
      bookingsByRequestId: new Map(),
      acceptedQuotesByRequestId: new Map(),
    });
  }, [request]);

  const selectedQuote = useMemo(
    () => quotes.find((quote) => quote.id === selectedQuoteId) || quotes[0] || null,
    [quotes, selectedQuoteId],
  );

  const handleAcceptQuote = async (quoteId: string) => {
    if (!accessToken) {
      setError("Please log in to continue.");
      return;
    }

    try {
      setIsAccepting(true);
      setError(null);
      setSuccessMessage(null);
      await quotesApi.respond(accessToken, quoteId, "accepted");
      setSuccessMessage("Quote accepted. You can continue to booking from the bookings tab.");
      const refreshedQuotes = await quotesApi.getByRequest(accessToken, requestId);
      setQuotes(refreshedQuotes);
      setSelectedQuoteId(quoteId);
    } catch (acceptError) {
      console.error("Failed to accept quote:", acceptError);
      setError(acceptError instanceof Error ? acceptError.message : "Failed to accept quote");
    } finally {
      setIsAccepting(false);
    }
  };

  const handleMessageProvider = async () => {
    if (!accessToken || !selectedQuote?.provider?.user.id) {
      setError("Unable to start a conversation right now.");
      return;
    }

    try {
      const conversation = await messagesApi.createConversation(accessToken, {
        participantId: selectedQuote.provider.user.id,
        requestId,
      });
      router.push({ pathname: "/(customer)/messages/[id]", params: { id: conversation.id } });
    } catch (messageError) {
      console.error("Failed to create conversation:", messageError);
      setError(messageError instanceof Error ? messageError.message : "Failed to start a conversation");
    }
  };

  if (isLoading) {
    return <LoadingScreen label="Loading request details..." />;
  }

  return (
    <PageContainer>
      <SectionHeader
        eyebrow="Customer"
        title={viewModel?.title || "Request details"}
        subtitle={viewModel?.category || "Detailed request view"}
      />

      {error ? <AlertBanner>{error}</AlertBanner> : null}
      {successMessage ? <AlertBanner variant="success">{successMessage}</AlertBanner> : null}

      {viewModel ? (
        <>
          <PanelCard style={styles.summaryCard}>
            <View style={styles.rowBetween}>
              <StatusPill
                label={requestStatusMap[viewModel.status].label}
                backgroundColor={requestStatusMap[viewModel.status].background}
                textColor={requestStatusMap[viewModel.status].text}
              />
              <Text style={styles.meta}>{viewModel.quotes} quotes</Text>
            </View>
            <Text style={styles.title}>{viewModel.title}</Text>
            <Text style={styles.description}>{viewModel.description}</Text>
            <Text style={styles.meta}>{viewModel.location}</Text>
            <Text style={styles.meta}>Created {viewModel.createdAt}</Text>
            <Text style={styles.meta}>Preferred date: {viewModel.preferredDate}</Text>
            <Text style={styles.meta}>Budget: {viewModel.budget}</Text>
          </PanelCard>

          <PanelCard style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Current status</Text>
            <Text style={styles.description}>
              {booking
                ? `Booked with ${viewModel.bookedProvider || "your provider"}`
                : "Quotes are still coming in. Review them below to move forward."}
            </Text>
            {booking ? (
              <AppButton
                label="Open booking"
                fullWidth={false}
                onPress={() => router.push({ pathname: "/(customer)/bookings/[id]", params: { id: booking.id } })}
              />
            ) : null}
          </PanelCard>

          <View style={styles.sectionSpacer}>
            <SectionHeader title="Quotes" subtitle="Review offers from providers and choose the best fit." />
          </View>

          <View style={styles.list}>
            {quotes.length > 0 ? (
              quotes.map((quote) => {
                const providerName = quote.provider?.companyName
                  ? quote.provider.companyName
                  : quote.provider
                    ? `${quote.provider.user.firstName} ${quote.provider.user.lastName}`
                    : "Unknown provider";

                return (
                  <Pressable
                    key={quote.id}
                    onPress={() => setSelectedQuoteId(quote.id)}
                    style={({ pressed }) => [styles.quoteWrap, pressed && styles.pressed]}
                  >
                    <PanelCard style={styles.quoteCard}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.quoteTitle}>{providerName}</Text>
                        <Text style={styles.quotePrice}>€{quote.price}</Text>
                      </View>
                      <Text style={styles.meta}>{quote.status}</Text>
                      <Text style={styles.description}>{quote.message}</Text>
                      <View style={styles.actionRow}>
                        <AppButton
                          label={quote.status === "accepted" ? "Accepted" : "Accept quote"}
                          fullWidth={false}
                          disabled={quote.status === "accepted" || isAccepting}
                          onPress={() => handleAcceptQuote(quote.id)}
                        />
                        <AppButton
                          label="Message"
                          variant="outline"
                          fullWidth={false}
                          onPress={handleMessageProvider}
                        />
                      </View>
                    </PanelCard>
                  </Pressable>
                );
              })
            ) : (
              <PanelCard style={styles.quoteCard}>
                <Text style={styles.title}>No quotes yet</Text>
                <Text style={styles.description}>Once providers respond, their offers will appear here.</Text>
              </PanelCard>
            )}
          </View>
        </>
      ) : null}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
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
    fontSize: 20,
    fontWeight: "800",
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 16,
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
  sectionSpacer: {
    marginTop: spacing.sm,
  },
  list: {
    gap: spacing.md,
  },
  quoteWrap: {
    borderRadius: radii.xl,
  },
  quoteCard: {
    gap: spacing.sm,
  },
  quoteTitle: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "800",
    flex: 1,
  },
  quotePrice: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "800",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.75,
  },
});
