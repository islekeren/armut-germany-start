"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts";
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
    <div className="min-h-screen bg-background">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl font-bold text-primary">Armut</span>
              <span className="text-sm text-muted">Pro</span>
            </Link>
            <Link href="/dashboard" className="text-muted hover:text-foreground">
              {tNav("overview")}
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-6 text-sm text-muted">
          <Link href="/dashboard" className="hover:text-primary">
            {tNav("overview")}
          </Link>
          {" / "}
          <span>{t("title")}</span>
        </nav>

        {error && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-700">
            {error}
          </div>
        )}

        <div className="flex h-[70vh] overflow-hidden rounded-xl border border-border bg-white">
          <aside className="w-full border-r border-border sm:w-80 lg:w-96">
            <div className="border-b border-border p-4">
              <h2 className="text-lg font-semibold">{t("title")}</h2>
            </div>

            <div className="overflow-y-auto">
              {isLoadingConversations && (
                <div className="p-4 text-sm text-muted">{t("loading")}</div>
              )}

              {!isLoadingConversations && conversations.length === 0 && (
                <div className="p-4 text-sm text-muted">{t("noConversations")}</div>
              )}

              {conversations.map((conversation) => {
                const otherName = getOtherParticipantName(conversation);
                const lastMessage = conversation.messages?.[0];
                const unreadCount = conversation.unreadCount || 0;

                return (
                  <button
                    key={conversation.id}
                    onClick={() => setSelectedConversationId(conversation.id)}
                    className={`flex w-full items-start gap-3 border-b border-border p-4 text-left transition hover:bg-background ${
                      selectedConversationId === conversation.id ? "bg-background" : ""
                    }`}
                  >
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-semibold text-white">
                      {otherName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{otherName}</span>
                        <span className="text-xs text-muted">
                          {formatListTime(conversation.lastMessageAt)}
                        </span>
                      </div>
                      <p className="text-sm text-muted">
                        {getConversationLabel(conversation)}
                      </p>
                      <p className="mt-1 truncate text-sm text-muted">
                        {lastMessage?.content || t("noMessagesYet")}
                      </p>
                    </div>
                    {unreadCount > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-white">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="hidden flex-1 flex-col sm:flex">
            {selectedConversation ? (
              <>
                <div className="flex items-center gap-4 border-b border-border p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-lg font-semibold text-white">
                    {getOtherParticipantName(selectedConversation).charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold">
                      {getOtherParticipantName(selectedConversation)}
                    </h3>
                    <p className="text-sm text-muted">
                      {getConversationLabel(selectedConversation)}
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {isLoadingMessages ? (
                    <div className="text-sm text-muted">{t("loadingMessages")}</div>
                  ) : (
                    <div className="mx-auto max-w-2xl space-y-4">
                      {messages.map((message) => {
                        const isOwnMessage = message.senderId === user?.id;
                        return (
                          <div
                            key={message.id}
                            className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-xs rounded-2xl px-4 py-2 lg:max-w-md ${
                                isOwnMessage ? "bg-primary text-white" : "bg-background"
                              }`}
                            >
                              <p>{message.content}</p>
                              <p
                                className={`mt-1 text-right text-xs ${
                                  isOwnMessage ? "text-white/70" : "text-muted"
                                }`}
                              >
                                {formatTime(message.createdAt)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="border-t border-border p-4">
                  <form
                    onSubmit={handleSendMessage}
                    className="mx-auto flex max-w-2xl gap-4"
                  >
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={t("placeholder")}
                      className="flex-1 rounded-full border border-border px-4 py-2 focus:border-primary focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isSending || !newMessage.trim()}
                      className="rounded-full bg-primary px-6 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
                    >
                      {isSending ? t("sending") : t("send")}
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-muted">{t("selectConversation")}</p>
              </div>
            )}
          </div>

          <div className="flex flex-1 items-center justify-center sm:hidden">
            <p className="text-muted">{t("selectConversation")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
