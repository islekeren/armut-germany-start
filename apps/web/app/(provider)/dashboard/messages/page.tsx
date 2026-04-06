"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts";
import { AlertBanner, MessagesWorkspace, ProviderSubpageShell } from "@/components";
import {
  getStoredAccessToken,
  messagesApi,
  type ConversationItem,
  type MessageItem,
} from "@/lib/api";

export default function ProviderMessagesPage() {
  const t = useTranslations("provider.messages");
  const tNav = useTranslations("provider.dashboard.navigation");
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    null
  );
  const [newMessage, setNewMessage] = useState("");
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatListTime = (dateString: string) =>
    new Date(dateString).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const getConversationLabel = (conversation: ConversationItem) => {
    if (conversation.request?.category?.nameEn) {
      return conversation.request.category.nameEn;
    }
    return t("conversationFallback");
  };

  const getOtherParticipantName = (conversation: ConversationItem) => {
    if (conversation.otherParticipant) {
      return `${conversation.otherParticipant.firstName} ${conversation.otherParticipant.lastName}`;
    }

    const fallbackUser = conversation.participants
      .map((participant) => participant.user)
      .find((participantUser) => participantUser?.id !== user?.id);

    if (!fallbackUser) return t("unknownUser");
    return `${fallbackUser.firstName} ${fallbackUser.lastName}`;
  };

  const fetchConversations = useCallback(async () => {
    const token = getStoredAccessToken();
    if (!token) {
      setError(t("loginRequired"));
      setIsLoadingConversations(false);
      return;
    }

    try {
      setError(null);
      const data = await messagesApi.getConversations(token);
      setConversations(data);

      const queryConversationId = searchParams.get("conversation");
      setSelectedConversationId((currentId) => {
        if (queryConversationId && data.some((item) => item.id === queryConversationId)) {
          return queryConversationId;
        }

        if (currentId && data.some((item) => item.id === currentId)) {
          return currentId;
        }

        const firstConversation = data[0];
        return firstConversation ? firstConversation.id : null;
      });
    } catch (err) {
      console.error("Failed to load conversations:", err);
      setError(err instanceof Error ? err.message : t("loadError"));
    } finally {
      setIsLoadingConversations(false);
    }
  }, [searchParams, t]);

  const fetchMessages = useCallback(
    async (conversationId: string) => {
      const token = getStoredAccessToken();
      if (!token) {
        setError(t("loginRequired"));
        return;
      }

      try {
        setIsLoadingMessages(true);
        const result = await messagesApi.getMessages(token, conversationId, 1, 100);
        setMessages(result.data);
        await messagesApi.markAsRead(token, conversationId);
        setConversations((prev) =>
          prev.map((item) =>
            item.id === conversationId ? { ...item, unreadCount: 0 } : item
          )
        );
      } catch (err) {
        console.error("Failed to load messages:", err);
        setError(err instanceof Error ? err.message : t("loadMessagesError"));
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [t]
  );

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    fetchMessages(selectedConversationId);
  }, [selectedConversationId, fetchMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || !selectedConversationId) return;

    const token = getStoredAccessToken();
    if (!token) {
      setError(t("loginRequired"));
      return;
    }

    try {
      setIsSending(true);
      setError(null);
      const sent = await messagesApi.sendMessage(token, {
        conversationId: selectedConversationId,
        content: newMessage.trim(),
      });
      setMessages((prev) => [...prev, sent]);
      setNewMessage("");
      await fetchConversations();
    } catch (err) {
      console.error("Failed to send message:", err);
      setError(err instanceof Error ? err.message : t("sendError"));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ProviderSubpageShell title={t("title")} backLabel={tNav("overview")}>
      {error && (
        <AlertBanner variant="warning" className="mb-6">
          {error}
        </AlertBanner>
      )}
      <div className="h-[72dvh] overflow-hidden rounded-xl border border-border bg-white sm:h-[70vh]">
        <MessagesWorkspace
          title={t("title")}
          loadingLabel={t("loading")}
          noConversationsLabel={t("noConversations")}
          noMessagesYetLabel={t("noMessagesYet")}
          loadingMessagesLabel={t("loadingMessages")}
          selectConversationLabel={t("selectConversation")}
          messagePlaceholder={t("placeholder")}
          sendLabel={t("send")}
          sendingLabel={t("sending")}
          conversations={conversations}
          messages={messages}
          selectedConversationId={selectedConversationId}
          selectedConversation={selectedConversation}
          isLoadingConversations={isLoadingConversations}
          isLoadingMessages={isLoadingMessages}
          isSending={isSending}
          currentUserId={user?.id}
          newMessage={newMessage}
          onNewMessageChange={setNewMessage}
          onSelectConversation={setSelectedConversationId}
          onSendMessage={handleSendMessage}
          getOtherParticipantName={getOtherParticipantName}
          getConversationLabel={getConversationLabel}
          formatListTime={formatListTime}
          formatTime={formatTime}
          wrapperClassName="flex h-full min-h-0 overflow-hidden"
        />
      </div>
    </ProviderSubpageShell>
  );
}
