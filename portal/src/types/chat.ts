export interface ChatMessageData {
  id: number | string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  metadata?: ChatMessageMetadata;
}

export interface ChatMessageMetadata {
  toolActivity?: { name: string; input: Record<string, unknown> }[];
  configChange?: ConfigChangeProposal;
  totalCostUsd?: number;
  durationMs?: number;
  model?: string;
}

export interface ConfigChangeProposal {
  action: "edit" | "create" | "delete";
  filePath: string;
  description: string;
  before: string;
  after: string;
  approvalStatus: "pending" | "approved" | "denied";
}

export interface ChatSSEEvent {
  type: "delta" | "tool_activity" | "config_change" | "done" | "error";
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  proposal?: ConfigChangeProposal;
  fullText?: string;
  messageId?: number;
  conversationId?: string;
  message?: string;
  metadata?: ChatMessageMetadata;
}
