import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { AlertBanner, LoadingScreen, PageContainer, PanelCard, SectionHeader } from "@/components";
import { useAuth } from "@/providers/AuthProvider";
import { messagesApi, type ConversationItem, type MessageItem } from "@/lib/api";
import { colors, radii, spacing } from "@/theme";
import { transformConversation } from "./helpers";

export function CustomerMessagesScreen() {
  const { user, accessToken } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) || null,
    [conversations, selectedConversationId],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadConversations() {
      if (!accessToken) {
        setError("Please log in to view your messages.");
        setIsLoadingConversations(false);
        return;
      }

      try {
        setError(null);
        const result = await messagesApi.getConversations(accessToken);
        if (!isMounted) return;

        setConversations(result);

        const firstConversation = result[0] || null;
        setSelectedConversationId(firstConversation?.id || null);
      } catch (loadError) {
        if (!isMounted) return;
        console.error("Failed to load conversations:", loadError);
        setError(loadError instanceof Error ? loadError.message : "Failed to load messages");
      } finally {
        if (isMounted) {
          setIsLoadingConversations(false);
        }
      }
    }

    void loadConversations();

    return () => {
      isMounted = false;
    };
  }, [accessToken]);

  useEffect(() => {
    let isMounted = true;

    async function loadMessages() {
      if (!accessToken || !selectedConversationId) {
        setMessages([]);
        return;
      }

      try {
        setIsLoadingMessages(true);
        const result = await messagesApi.getMessages(accessToken, selectedConversationId, 1, 100);
        if (!isMounted) return;

        setMessages(result.data);
        await messagesApi.markAsRead(accessToken, selectedConversationId);
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === selectedConversationId ? { ...conversation, unreadCount: 0 } : conversation,
          ),
        );
      } catch (loadError) {
        if (!isMounted) return;
        console.error("Failed to load messages:", loadError);
        setError(loadError instanceof Error ? loadError.message : "Failed to load messages");
      } finally {
        if (isMounted) {
          setIsLoadingMessages(false);
        }
      }
    }

    void loadMessages();

    return () => {
      isMounted = false;
    };
  }, [accessToken, selectedConversationId]);

  if (isLoadingConversations) {
    return <LoadingScreen label="Loading your conversations..." />;
  }

  return (
    <PageContainer>
      <SectionHeader
        eyebrow="Customer"
        title="Messages"
        subtitle="Keep conversations with providers in one native thread."
      />

      {error ? <AlertBanner>{error}</AlertBanner> : null}

      <View style={styles.layout}>
        <View style={styles.listPane}>
          {conversations.length > 0 ? (
            conversations.map((conversation) => {
              const card = transformConversation(conversation, user?.id);
              return (
                <Pressable
                  key={conversation.id}
                  onPress={() => {
                    setSelectedConversationId(conversation.id);
                    router.push({
                      pathname: "/(customer)/messages/[id]",
                      params: { id: conversation.id },
                    });
                  }}
                  style={({ pressed }) => [styles.conversationWrap, pressed && styles.pressed]}
                >
                  <PanelCard style={styles.conversationCard}>
                    <View style={styles.rowBetween}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{card.name.charAt(0)}</Text>
                      </View>
                      {card.unreadCount > 0 ? (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadText}>{card.unreadCount}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.conversationTitle}>{card.name}</Text>
                    <Text style={styles.conversationLabel}>{card.label}</Text>
                    <Text style={styles.conversationPreview}>{card.lastMessage}</Text>
                    <Text style={styles.conversationMeta}>{card.lastMessageAt}</Text>
                  </PanelCard>
                </Pressable>
              );
            })
          ) : (
            <PanelCard style={styles.emptyCard}>
              <Text style={styles.conversationTitle}>No conversations yet</Text>
              <Text style={styles.conversationPreview}>
                Conversations with providers will show up here after you start a request or booking.
              </Text>
            </PanelCard>
          )}
        </View>

        <PanelCard style={styles.previewCard}>
          {selectedConversation ? (
            <>
              <Text style={styles.previewHeading}>{transformConversation(selectedConversation, user?.id).name}</Text>
              <Text style={styles.conversationLabel}>
                {transformConversation(selectedConversation, user?.id).label}
              </Text>

              {isLoadingMessages ? (
                <Text style={styles.conversationPreview}>Loading thread...</Text>
              ) : (
                <View style={styles.messageList}>
                  {messages.length > 0 ? (
                    messages.map((message) => {
                      const isOwnMessage = message.senderId === user?.id;
                      return (
                        <View
                          key={message.id}
                          style={[
                            styles.messageBubble,
                            isOwnMessage ? styles.outgoingBubble : styles.incomingBubble,
                          ]}
                        >
                          <Text style={[styles.messageText, isOwnMessage && styles.outgoingText]}>
                            {message.content}
                          </Text>
                        </View>
                      );
                    })
                  ) : (
                    <Text style={styles.conversationPreview}>No messages yet.</Text>
                  )}
                </View>
              )}
            </>
          ) : (
            <Text style={styles.conversationTitle}>Select a conversation</Text>
          )}
        </PanelCard>
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  layout: {
    gap: spacing.md,
  },
  listPane: {
    gap: spacing.md,
  },
  conversationWrap: {
    borderRadius: radii.xl,
  },
  conversationCard: {
    gap: spacing.xs,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
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
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  unreadText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "800",
  },
  conversationTitle: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "800",
  },
  conversationLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  conversationPreview: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  conversationMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  previewCard: {
    gap: spacing.sm,
  },
  previewHeading: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: "800",
  },
  messageList: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  messageBubble: {
    maxWidth: "86%",
    borderRadius: radii.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  outgoingBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
  },
  incomingBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#EEF2FF",
  },
  messageText: {
    color: colors.foreground,
    fontSize: 14,
    lineHeight: 20,
  },
  outgoingText: {
    color: colors.white,
  },
  emptyCard: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.75,
  },
});
