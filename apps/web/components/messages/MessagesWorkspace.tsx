import type { FormEvent } from "react";
import type { ConversationItem, MessageItem } from "@/lib/api";

interface MessagesWorkspaceProps {
  title: string;
  loadingLabel: string;
  noConversationsLabel: string;
  noMessagesYetLabel: string;
  loadingMessagesLabel: string;
  selectConversationLabel: string;
  messagePlaceholder: string;
  sendLabel: string;
  sendingLabel: string;
  conversations: ConversationItem[];
  messages: MessageItem[];
  selectedConversationId: string | null;
  selectedConversation: ConversationItem | null;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;
  currentUserId?: string;
  newMessage: string;
  onNewMessageChange: (value: string) => void;
  onSelectConversation: (conversationId: string) => void;
  onSendMessage: (event: FormEvent<HTMLFormElement>) => void;
  getOtherParticipantName: (conversation: ConversationItem) => string;
  getConversationLabel: (conversation: ConversationItem) => string;
  formatListTime: (dateString: string) => string;
  formatTime: (dateString: string) => string;
  incomingBubbleClassName?: string;
  asideClassName?: string;
  chatHeaderClassName?: string;
  composerClassName?: string;
  wrapperClassName?: string;
}

export function MessagesWorkspace({
  title,
  loadingLabel,
  noConversationsLabel,
  noMessagesYetLabel,
  loadingMessagesLabel,
  selectConversationLabel,
  messagePlaceholder,
  sendLabel,
  sendingLabel,
  conversations,
  messages,
  selectedConversationId,
  selectedConversation,
  isLoadingConversations,
  isLoadingMessages,
  isSending,
  currentUserId,
  newMessage,
  onNewMessageChange,
  onSelectConversation,
  onSendMessage,
  getOtherParticipantName,
  getConversationLabel,
  formatListTime,
  formatTime,
  incomingBubbleClassName = "bg-background",
  asideClassName = "w-full border-r border-border sm:w-80 lg:w-96",
  chatHeaderClassName = "",
  composerClassName = "",
  wrapperClassName = "flex flex-1 overflow-hidden",
}: MessagesWorkspaceProps) {
  return (
    <div className={wrapperClassName}>
      <aside className={asideClassName}>
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>

        <div className="overflow-y-auto">
          {isLoadingConversations && (
            <div className="p-4 text-sm text-muted">{loadingLabel}</div>
          )}

          {!isLoadingConversations && conversations.length === 0 && (
            <div className="p-4 text-sm text-muted">{noConversationsLabel}</div>
          )}

          {conversations.map((conversation) => {
            const otherName = getOtherParticipantName(conversation);
            const lastMessage = conversation.messages?.[0];
            const unreadCount = conversation.unreadCount || 0;

            return (
              <button
                key={conversation.id}
                onClick={() => onSelectConversation(conversation.id)}
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
                  <p className="text-sm text-muted">{getConversationLabel(conversation)}</p>
                  <p className="mt-1 truncate text-sm text-muted">
                    {lastMessage?.content || noMessagesYetLabel}
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
            <div className={`flex items-center gap-4 border-b border-border p-4 ${chatHeaderClassName}`.trim()}>
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
                <div className="text-sm text-muted">{loadingMessagesLabel}</div>
              ) : (
                <div className="mx-auto max-w-2xl space-y-4">
                  {messages.map((message) => {
                    const isOwnMessage = message.senderId === currentUserId;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-xs rounded-2xl px-4 py-2 lg:max-w-md ${
                            isOwnMessage
                              ? "bg-primary text-white"
                              : incomingBubbleClassName
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

            <div className={`border-t border-border p-4 ${composerClassName}`.trim()}>
              <form onSubmit={onSendMessage} className="mx-auto flex max-w-2xl gap-4">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(event) => onNewMessageChange(event.target.value)}
                  placeholder={messagePlaceholder}
                  className="flex-1 rounded-full border border-border px-4 py-2 focus:border-primary focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSending || !newMessage.trim()}
                  className="rounded-full bg-primary px-6 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
                >
                  {isSending ? sendingLabel : sendLabel}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted">{selectConversationLabel}</p>
          </div>
        )}
      </div>

      <div className="flex flex-1 items-center justify-center sm:hidden">
        <p className="text-muted">{selectConversationLabel}</p>
      </div>
    </div>
  );
}
