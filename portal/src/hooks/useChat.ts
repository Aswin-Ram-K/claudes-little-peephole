"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ChatMessageData, ConfigChangeProposal, ChatSSEEvent } from "@/types/chat";

const STORAGE_KEY = "claude-portal-conversation-id";

function generateId(): string {
  return crypto.randomUUID();
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [pendingApproval, setPendingApproval] = useState<ConfigChangeProposal | null>(null);
  const [pendingMessageId, setPendingMessageId] = useState<number | null>(null);
  const [conversationId, setConversationId] = useState<string>("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Initialize conversationId from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setConversationId(stored);
    } else {
      const newId = generateId();
      localStorage.setItem(STORAGE_KEY, newId);
      setConversationId(newId);
    }
    setIsInitialized(true);
  }, []);

  // Load conversation history when conversationId is set
  useEffect(() => {
    if (!conversationId) return;

    fetch(`/api/chat/history?conversationId=${conversationId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.messages?.length > 0) {
          setMessages(
            data.messages.map((m: Record<string, unknown>) => ({
              id: m.id,
              conversationId: m.conversationId,
              role: m.role,
              content: m.content,
              timestamp: new Date(m.createdAt as string),
              metadata: m.metadata as ChatMessageData["metadata"],
            }))
          );
        }
      })
      .catch(() => {
        // History fetch failed — start fresh (DB might not be ready)
      });
  }, [conversationId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming || !conversationId) return;

      setError(null);

      // Add user message to UI immediately
      const userMsg: ChatMessageData = {
        id: `temp-${Date.now()}`,
        conversationId,
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);
      setStreamingText("");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text.trim(), conversationId }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Chat request failed: ${response.statusText}`);
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        let sseBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });

          // Parse SSE events (split on double newline)
          const events = sseBuffer.split("\n\n");
          sseBuffer = events.pop() || "";

          for (const eventStr of events) {
            const dataLine = eventStr
              .split("\n")
              .find((line) => line.startsWith("data: "));
            if (!dataLine) continue;

            try {
              const event: ChatSSEEvent = JSON.parse(dataLine.slice(6));

              switch (event.type) {
                case "delta":
                  if (event.text) {
                    accumulated += event.text;
                    setStreamingText(accumulated);
                  }
                  break;

                case "config_change":
                  if (event.proposal) {
                    setPendingApproval(event.proposal);
                  }
                  break;

                case "done":
                  if (event.messageId) {
                    setPendingMessageId(event.messageId);
                  }
                  // Add the complete assistant message
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: event.messageId || `assistant-${Date.now()}`,
                      conversationId,
                      role: "assistant",
                      content: event.fullText || accumulated,
                      timestamp: new Date(),
                      metadata: event.metadata,
                    },
                  ]);
                  setStreamingText("");
                  setIsStreaming(false);
                  break;

                case "error":
                  setError(event.message || "An error occurred");
                  setIsStreaming(false);
                  setStreamingText("");
                  break;
              }
            } catch {
              // Skip malformed events
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message);
        }
        setIsStreaming(false);
        setStreamingText("");
      } finally {
        abortRef.current = null;
      }
    },
    [conversationId, isStreaming]
  );

  const approveChange = useCallback(
    async (proposal: ConfigChangeProposal) => {
      try {
        const res = await fetch("/api/chat/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId: pendingMessageId,
            filePath: proposal.filePath,
            action: proposal.action,
            before: proposal.before,
            after: proposal.after,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to apply change");
          return;
        }

        // Update the proposal status in the message
        setPendingApproval(null);
        setPendingMessageId(null);

        // Add a system message confirming the change
        setMessages((prev) => [
          ...prev,
          {
            id: `system-${Date.now()}`,
            conversationId,
            role: "system",
            content: `Change applied to ${proposal.filePath}`,
            timestamp: new Date(),
          },
        ]);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [conversationId, pendingMessageId]
  );

  const denyChange = useCallback(() => {
    setPendingApproval(null);
    setPendingMessageId(null);
    setMessages((prev) => [
      ...prev,
      {
        id: `system-${Date.now()}`,
        conversationId,
        role: "system",
        content: "Change denied by user",
        timestamp: new Date(),
      },
    ]);
  }, [conversationId]);

  const newConversation = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const newId = generateId();
    localStorage.setItem(STORAGE_KEY, newId);
    setConversationId(newId);
    setMessages([]);
    setStreamingText("");
    setIsStreaming(false);
    setPendingApproval(null);
    setPendingMessageId(null);
    setError(null);
  }, []);

  const stopStreaming = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
    if (streamingText) {
      setMessages((prev) => [
        ...prev,
        {
          id: `partial-${Date.now()}`,
          conversationId,
          role: "assistant",
          content: streamingText,
          timestamp: new Date(),
        },
      ]);
      setStreamingText("");
    }
  }, [conversationId, streamingText]);

  return {
    messages,
    isStreaming,
    isInitialized,
    streamingText,
    pendingApproval,
    conversationId,
    error,
    sendMessage,
    approveChange,
    denyChange,
    newConversation,
    stopStreaming,
  };
}
