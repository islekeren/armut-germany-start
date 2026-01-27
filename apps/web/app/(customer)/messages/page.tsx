"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Header } from "@/components";

const mockConversations = [
  {
    id: "1",
    provider: {
      name: "Smith Services",
      contact: "John Smith",
      image: null,
    },
    lastMessage: "Sure, I can come by on Monday at 10 AM.",
    lastMessageTime: "10 min ago",
    unread: 2,
    service: "Apartment Cleaning",
  },
  {
    id: "2",
    provider: {
      name: "Johnson Cleaning",
      contact: "Anna Johnson",
      image: null,
    },
    lastMessage: "Thank you for your inquiry. I will get back to you shortly.",
    lastMessageTime: "2 hours ago",
    unread: 0,
    service: "Office Cleaning",
  },
  {
    id: "3",
    provider: {
      name: "Clean & Fresh",
      contact: "Thomas Weber",
      image: null,
    },
    lastMessage: "All right, see you on Friday then!",
    lastMessageTime: "Yesterday",
    unread: 0,
    service: "Window Cleaning",
  },
];

const mockMessages = [
  {
    id: "1",
    sender: "provider",
    content: "Hello! Thank you for your inquiry about apartment cleaning.",
    timestamp: "10:30",
  },
  {
    id: "2",
    sender: "customer",
    content:
      "Hi! Yes, I would like a thorough cleaning. When could you come by?",
    timestamp: "10:35",
  },
  {
    id: "3",
    sender: "provider",
    content:
      "I have availability on Monday or Wednesday. Which day works better for you?",
    timestamp: "10:40",
  },
  {
    id: "4",
    sender: "customer",
    content: "Monday would be perfect. What time?",
    timestamp: "10:42",
  },
  {
    id: "5",
    sender: "provider",
    content: "Sure, I can come by on Monday at 10 AM.",
    timestamp: "10:45",
  },
];

export default function MessagesPage() {
  const t = useTranslations("customer.messages");
  const tRequests = useTranslations("customer.requests");
  const [selectedConversation, setSelectedConversation] = useState(
    mockConversations[0]
  );
  const [newMessage, setNewMessage] = useState("");

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    // Handle send message
    setNewMessage("");
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header />

      {/* Messages Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Conversations List */}
        <aside className="w-full border-r border-border bg-white sm:w-80 lg:w-96">
          <div className="border-b border-border p-4">
            <h2 className="text-lg font-semibold">{t("title")}</h2>
          </div>
          <div className="overflow-y-auto">
            {mockConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={`flex w-full items-start gap-3 border-b border-border p-4 text-left transition hover:bg-background ${
                  selectedConversation.id === conv.id ? "bg-background" : ""
                }`}
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-semibold text-white">
                  {conv.provider.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{conv.provider.name}</span>
                    <span className="text-xs text-muted">
                      {conv.lastMessageTime}
                    </span>
                  </div>
                  <p className="text-sm text-muted">{conv.service}</p>
                  <p className="mt-1 truncate text-sm text-muted">
                    {conv.lastMessage}
                  </p>
                </div>
                {conv.unread > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-white">
                    {conv.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </aside>

        {/* Chat Area */}
        <div className="hidden flex-1 flex-col sm:flex">
          {/* Chat Header */}
          <div className="flex items-center gap-4 border-b border-border bg-white p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-lg font-semibold text-white">
              {selectedConversation.provider.name.charAt(0)}
            </div>
            <div>
              <h3 className="font-semibold">
                {selectedConversation.provider.name}
              </h3>
              <p className="text-sm text-muted">
                {selectedConversation.service}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mx-auto max-w-2xl space-y-4">
              {mockMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.sender === "customer"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-xs rounded-2xl px-4 py-2 lg:max-w-md ${
                      message.sender === "customer"
                        ? "bg-primary text-white"
                        : "bg-white"
                    }`}
                  >
                    <p>{message.content}</p>
                    <p
                      className={`mt-1 text-right text-xs ${
                        message.sender === "customer"
                          ? "text-white/70"
                          : "text-muted"
                      }`}
                    >
                      {message.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-border bg-white p-4">
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
                className="rounded-full bg-primary px-6 py-2 font-medium text-white hover:bg-primary-dark"
              >
                {t("send")}
              </button>
            </form>
          </div>
        </div>

        {/* Empty State for Mobile */}
        <div className="flex flex-1 items-center justify-center sm:hidden">
          <p className="text-muted">{t("selectConversation")}</p>
        </div>
      </div>
    </div>
  );
}
