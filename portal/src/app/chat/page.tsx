"use client";

import { useRef, useEffect } from "react";
import { PageTransition } from "@/components/layout/PageTransition";
import { Badge } from "@/components/shared/Badge";
import { StreamingText } from "@/components/chat/StreamingText";
import { ConfigDiffPreview } from "@/components/chat/ConfigDiffPreview";
import { ApprovalDialog } from "@/components/chat/ApprovalDialog";
import { useChat } from "@/hooks/useChat";
import {
  MessageSquare,
  Send,
  Settings,
  Bot,
  User,
  Loader2,
  Plus,
  AlertCircle,
  Square,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessageData } from "@/types/chat";

function ChatBubble({ message }: { message: ChatMessageData }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center animate-slide-up">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-surface/50 border border-border-subtle">
          <CheckCircle2 className="w-3 h-3 text-status-success" />
          <span className="text-xs text-text-muted">{message.content}</span>
        </div>
      </div>
    );
  }

  const proposals = (message.metadata as Record<string, unknown>)?.configChangeProposals as
    | { filePath: string; description: string; before: string; after: string; approvalStatus: string }[]
    | undefined;

  return (
    <div
      className={cn(
        "flex gap-3 animate-slide-up",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
          isUser
            ? "bg-gradient-to-br from-accent-indigo to-accent-violet"
            : "bg-bg-surface border border-border-subtle"
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-accent-indigo" />
        )}
      </div>
      <div
        className={cn(
          "max-w-[85%] sm:max-w-[75%] rounded-xl px-4 py-3 space-y-3",
          isUser
            ? "bg-gradient-to-br from-accent-indigo/20 to-accent-violet/20 border border-accent-indigo/20"
            : "bg-bg-card border border-border-subtle"
        )}
      >
        {isUser ? (
          <p className="text-sm text-text-primary whitespace-pre-wrap">{message.content}</p>
        ) : (
          <StreamingText text={message.content} isStreaming={false} />
        )}

        {proposals?.map((proposal, i) => (
          <ConfigDiffPreview
            key={i}
            filePath={proposal.filePath}
            description={proposal.description}
            before={proposal.before}
            after={proposal.after}
            status={proposal.approvalStatus as "pending" | "approved" | "denied"}
          />
        ))}

        {!isUser && message.metadata?.totalCostUsd !== undefined && (
          <div className="flex items-center gap-3 pt-1 text-[10px] text-text-muted">
            {message.metadata.model && <span>{message.metadata.model}</span>}
            {message.metadata.durationMs && (
              <span>{(message.metadata.durationMs / 1000).toFixed(1)}s</span>
            )}
            <span>${message.metadata.totalCostUsd.toFixed(4)}</span>
          </div>
        )}

        <span className="text-xs text-text-muted block">
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const {
    messages,
    isStreaming,
    isInitialized,
    streamingText,
    pendingApproval,
    error,
    sendMessage,
    approveChange,
    denyChange,
    newConversation,
    stopStreaming,
  } = useChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const handleSend = () => {
    const input = inputRef.current;
    if (!input) return;
    const text = input.value.trim();
    if (!text || isStreaming) return;
    sendMessage(text);
    input.value = "";
  };

  const welcomeMessage: ChatMessageData = {
    id: "welcome",
    conversationId: "",
    role: "assistant",
    content:
      "Hello! I'm your Claude Code configuration assistant. I can help you manage your settings, hooks, skills, and automations.\n\nTry asking me:\n- \"Show my current settings\"\n- \"What hooks do I have configured?\"\n- \"Add a new SessionStart hook\"\n- \"Explain my CLAUDE.md\"",
    timestamp: new Date(),
  };

  const displayMessages = messages.length === 0 ? [welcomeMessage] : messages;

  return (
    <PageTransition>
      <div className="flex flex-col h-[calc(100vh-7rem)]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-accent-indigo" />
              Chat
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="accent" className="flex items-center gap-1">
              <Settings className="w-3 h-3" />
              Scoped to: Claude Code Config
            </Badge>
            <button
              onClick={newConversation}
              className="p-2 rounded-lg bg-bg-surface border border-border-subtle hover:bg-bg-hover transition-colors"
              title="New conversation"
            >
              <Plus className="w-4 h-4 text-text-secondary" />
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-2.5 mb-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-4 min-h-0">
          {displayMessages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}

          {/* Streaming response */}
          {isStreaming && streamingText && (
            <div className="flex gap-3 animate-slide-up">
              <div className="w-8 h-8 rounded-lg bg-bg-surface border border-border-subtle flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-accent-indigo" />
              </div>
              <div className="max-w-[85%] sm:max-w-[75%] bg-bg-card border border-border-subtle rounded-xl px-4 py-3">
                <StreamingText text={streamingText} isStreaming={true} />
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isStreaming && !streamingText && (
            <div className="flex gap-3 animate-slide-up">
              <div className="w-8 h-8 rounded-lg bg-bg-surface border border-border-subtle flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-accent-indigo" />
              </div>
              <div className="bg-bg-card border border-border-subtle rounded-xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-accent-indigo animate-spin" />
                <span className="text-xs text-text-muted">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border-subtle pt-4">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask about your Claude Code setup..."
                className="w-full px-4 py-3 bg-bg-surface border border-border-subtle rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-indigo/50 focus:ring-1 focus:ring-accent-indigo/20 transition-all resize-none"
                rows={1}
                disabled={isStreaming || !isInitialized}
              />
            </div>
            {isStreaming ? (
              <button
                onClick={stopStreaming}
                className="p-3 rounded-xl bg-bg-surface border border-border-subtle hover:bg-bg-hover transition-colors"
                title="Stop generating"
              >
                <Square className="w-4 h-4 text-text-secondary" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                className="p-3 rounded-xl bg-gradient-to-r from-accent-indigo to-accent-violet text-white hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Approval Dialog */}
      {pendingApproval && (
        <ApprovalDialog
          proposal={pendingApproval}
          onApprove={() => approveChange(pendingApproval)}
          onDeny={denyChange}
        />
      )}
    </PageTransition>
  );
}
