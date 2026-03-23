import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { AlertBanner, AppButton, LoadingScreen, PageContainer, PanelCard, SectionHeader } from "@/components";
import { useAuth } from "@/providers/AuthProvider";
import { messagesApi, type ConversationItem, type MessageItem } from "@/lib/api";
import { colors, radii, spacing } from "@/theme";
import { getConversationLabel, getOtherParticipantName } from "./helpers";

export function MessageThreadScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const conversationId = typeof params.id === "string" ? params.id : "";
  const { user, accessToken } = useAuth();

  const [conversation, setConversation] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadThread() {
      if (!conversationId) {
        setError("Conversation not found.");
        setIsLoading(false);
        return;
      }

      if (!accessToken) {
        setError("Please log in to view messages.");
        setIsLoading(false);
        return;
      }

      try {
        setError(null);
        const [conversationData, messageData] = await Promise.all([
          messagesApi.getConversation(accessToken, conversationId),
          messagesApi.getMessages(accessToken, conversationId, 1, 100),
        ]);

        if (!isMounted) return;

        setConversation(conversationData);
        setMessages(messageData.data);
        await messagesApi.markAsRead(accessToken, conversationId);
      } catch (loadError) {
        if (!isMounted) return;
        console.error("Failed to load conversation:", loadError);
        setError(loadError instanceof Error ? loadError.message : "Failed to load conversation");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadThread();

    return () => {
      isMounted = false;
    };
  }, [accessToken, conversationId]);

  const handleSend = async () => {
    if (!accessToken || !draft.trim() || !conversationId) {
      return;
    }

    try {
      setIsSending(true);
      setError(null);
      const sent = await messagesApi.sendMessage(accessToken, {
        conversationId,
        content: draft.trim(),
      });
      setMessages((current) => [...current, sent]);
      setDraft("");
    } catch (sendError) {
      console.error("Failed to send message:", sendError);
      setError(sendError instanceof Error ? sendError.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return <LoadingScreen label="Loading conversation..." />;
  }

  return (
    <PageContainer>
      <SectionHeader
        eyebrow="Customer"
        title={getOtherParticipantName(conversation, user?.id)}
        subtitle={conversation ? getConversationLabel(conversation) : "Conversation"}
      />

      {error ? <AlertBanner>{error}</AlertBanner> : null}

      <PanelCard style={styles.threadCard}>
        <View style={styles.messageList}>
          {messages.length > 0 ? (
            messages.map((message) => {
              const isOwn = message.senderId === user?.id;
              return (
                <View
                  key={message.id}
                  style={[styles.messageBubble, isOwn ? styles.outgoingBubble : styles.incomingBubble]}
                >
                  <Text style={[styles.messageText, isOwn && styles.outgoingText]}>{message.content}</Text>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No messages yet. Say hello to get the conversation moving.</Text>
          )}
        </View>
      </PanelCard>

      <PanelCard style={styles.composerCard}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a message"
          multiline
          style={styles.input}
        />
        <View style={styles.actionRow}>
          <AppButton
            label={isSending ? "Sending..." : "Send message"}
            onPress={handleSend}
            disabled={isSending || !draft.trim()}
          />
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>
      </PanelCard>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  threadCard: {
    gap: spacing.sm,
  },
  messageList: {
    gap: spacing.sm,
  },
  messageBubble: {
    maxWidth: "88%",
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
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  composerCard: {
    gap: spacing.sm,
  },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.foreground,
    textAlignVertical: "top",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    alignItems: "center",
  },
  backButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  backText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
});
