import { useEffect, useMemo, useState } from "react";
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
import { quotesApi, providerApi, type ProviderRequest } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/theme";
import { formatMoney, formatRelativeAge, formatShortDate, StatusBadge } from "./shared";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "cleaning", label: "Cleaning" },
  { key: "renovation", label: "Renovation" },
  { key: "garden", label: "Garden" },
];

export function ProviderRequestsScreen() {
  const { accessToken } = useAuth();
  const [filter, setFilter] = useState("all");
  const [requests, setRequests] = useState<ProviderRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quoteSuccess, setQuoteSuccess] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    price: "",
    message: "",
    validUntil: "",
  });

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) ?? null,
    [requests, selectedRequestId],
  );

  useEffect(() => {
    let mounted = true;

    async function loadRequests() {
      if (!accessToken) {
        setError("Missing provider session. Please log in again.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setQuoteSuccess(null);

      try {
        const category = filter === "all" ? undefined : filter;
        const response = await providerApi.getRequests(accessToken, { category });
        if (!mounted) return;

        setRequests(response.data);
        setSelectedRequestId((current) =>
          current && response.data.some((request) => request.id === current)
            ? current
            : response.data[0]?.id ?? null,
        );
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load provider requests.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadRequests();

    return () => {
      mounted = false;
    };
  }, [accessToken, filter]);

  useEffect(() => {
    if (!selectedRequest) return;

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    setQuoteForm({
      price: selectedRequest.budgetMin ? String(selectedRequest.budgetMin) : "",
      message: "",
      validUntil: nextWeek.toISOString().slice(0, 10),
    });
  }, [selectedRequest]);

  async function handleSubmitQuote() {
    if (!selectedRequest || !accessToken) {
      return;
    }

    const price = Number(quoteForm.price);
    if (!price || price <= 0) {
      setQuoteError("Enter a valid quote price.");
      return;
    }

    if (!quoteForm.message.trim()) {
      setQuoteError("Add a short message for the customer.");
      return;
    }

    setIsSubmitting(true);
    setQuoteError(null);
    setQuoteSuccess(null);

    try {
      await quotesApi.create(accessToken, {
        requestId: selectedRequest.id,
        price,
        message: quoteForm.message.trim(),
        validUntil: quoteForm.validUntil,
      });

      setRequests((current) =>
        current.filter((request) => request.id !== selectedRequest.id),
      );
      setSelectedRequestId(null);
      setQuoteSuccess("Offer sent successfully.");
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : "Failed to send the offer.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return <LoadingScreen label="Loading provider requests..." />;
  }

  return (
    <PageContainer>
      <View style={styles.header}>
        <SectionHeader
          eyebrow="Requests"
          title="Request feed"
          subtitle="Choose a lead, review the details, and send an offer from your phone."
        />
        <AppButton
          label="Dashboard"
          onPress={() => router.push("/(provider)/(tabs)")}
          fullWidth={false}
          variant="ghost"
        />
      </View>

      {error ? <AlertBanner variant="warning">{error}</AlertBanner> : null}
      {quoteSuccess ? <AlertBanner variant="success">{quoteSuccess}</AlertBanner> : null}
      {quoteError ? <AlertBanner variant="error">{quoteError}</AlertBanner> : null}

      <View style={styles.filterRow}>
        {FILTERS.map((item) => {
          const active = filter === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={[styles.filterChip, active ? styles.filterChipActive : null]}
            >
              <Text style={[styles.filterLabel, active ? styles.filterLabelActive : null]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedRequest ? (
        <PanelCard style={styles.detailCard}>
          <View style={styles.detailTopRow}>
            <View style={{ flex: 1 }}>
              <StatusBadge
                label={selectedRequest.category}
                backgroundColor="#EFF6FF"
                textColor={colors.primary}
              />
              <Text style={styles.detailTitle}>{selectedRequest.title}</Text>
              <Text style={styles.detailMeta}>
                {selectedRequest.location} • {formatRelativeAge(selectedRequest.createdAt)}
              </Text>
            </View>
            <Text style={styles.detailBudget}>{selectedRequest.budget || "Open budget"}</Text>
          </View>

          <Text style={styles.description}>{selectedRequest.description}</Text>

          <View style={styles.detailGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailItemLabel}>Customer</Text>
              <Text style={styles.detailItemValue}>{selectedRequest.customer.name}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailItemLabel}>Member since</Text>
              <Text style={styles.detailItemValue}>{selectedRequest.customer.memberSince}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailItemLabel}>Date</Text>
              <Text style={styles.detailItemValue}>
                {selectedRequest.preferredDate
                  ? formatShortDate(selectedRequest.preferredDate)
                  : "Flexible"}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailItemLabel}>Budget</Text>
              <Text style={styles.detailItemValue}>{selectedRequest.budget || "No range yet"}</Text>
            </View>
          </View>

          <View style={styles.composer}>
            <Text style={styles.composerTitle}>Send offer</Text>
            <View style={styles.inputGroup}>
              <FormLabel>Price</FormLabel>
              <FormInput
                keyboardType="numeric"
                value={quoteForm.price}
                onChangeText={(price) => setQuoteForm((current) => ({ ...current, price }))}
                placeholder="250"
              />
            </View>
            <View style={styles.inputGroup}>
              <FormLabel>Message</FormLabel>
              <FormTextarea
                value={quoteForm.message}
                onChangeText={(message) => setQuoteForm((current) => ({ ...current, message }))}
                placeholder="Tell the customer how you would approach the job."
              />
            </View>
            <View style={styles.inputGroup}>
              <FormLabel>Valid until</FormLabel>
              <FormInput
                value={quoteForm.validUntil}
                onChangeText={(validUntil) =>
                  setQuoteForm((current) => ({ ...current, validUntil }))
                }
                placeholder="YYYY-MM-DD"
              />
            </View>
            <AppButton
              label={isSubmitting ? "Sending..." : "Send offer"}
              onPress={handleSubmitQuote}
              disabled={isSubmitting}
            />
          </View>
        </PanelCard>
      ) : null}

      <View style={styles.stack}>
        {requests.length === 0 ? (
          <PanelCard>
            <Text style={styles.emptyTitle}>No requests found</Text>
            <Text style={styles.emptyText}>
              Change the filter or check back later for fresh leads.
            </Text>
          </PanelCard>
        ) : (
          requests.map((request) => {
            const active = request.id === selectedRequestId;
            return (
              <Pressable
                key={request.id}
                onPress={() => setSelectedRequestId(request.id)}
                style={[styles.requestCard, active ? styles.requestCardActive : null]}
              >
                <View style={styles.requestHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.requestTitle}>{request.title}</Text>
                    <Text style={styles.requestMeta}>
                      {request.categoryName} • {request.location}
                    </Text>
                  </View>
                  <Text style={styles.requestTime}>{formatRelativeAge(request.createdAt)}</Text>
                </View>
                <Text style={styles.requestDescription} numberOfLines={2}>
                  {request.description}
                </Text>
                <View style={styles.requestFooter}>
                  <Text style={styles.requestBudget}>
                    {request.budget || formatMoney(request.budgetMin || 0)}
                  </Text>
                  <Text style={styles.requestDate}>
                    {request.preferredDate ? formatShortDate(request.preferredDate) : "Flexible"}
                  </Text>
                </View>
              </Pressable>
            );
          })
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
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  filterChip: {
    borderRadius: radii.full,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterLabel: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "700",
  },
  filterLabelActive: {
    color: colors.white,
  },
  detailCard: {
    gap: spacing.md,
  },
  detailTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  detailTitle: {
    color: colors.foreground,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    marginTop: spacing.sm,
  },
  detailMeta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  detailBudget: {
    color: colors.secondary,
    fontSize: 16,
    fontWeight: "800",
  },
  description: {
    color: colors.foreground,
    fontSize: 15,
    lineHeight: 22,
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  detailItem: {
    flexBasis: "48%",
    gap: 4,
  },
  detailItemLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  detailItemValue: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "700",
  },
  composer: {
    gap: spacing.md,
  },
  composerTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "800",
  },
  inputGroup: {
    gap: spacing.xs,
  },
  stack: {
    gap: spacing.md,
  },
  requestCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  requestCardActive: {
    borderColor: colors.primary,
    backgroundColor: "#F8FBFF",
  },
  requestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  requestTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "800",
  },
  requestMeta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  requestTime: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  requestDescription: {
    color: colors.foreground,
    fontSize: 14,
    lineHeight: 21,
  },
  requestFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  requestBudget: {
    color: colors.secondary,
    fontSize: 14,
    fontWeight: "800",
  },
  requestDate: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
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
