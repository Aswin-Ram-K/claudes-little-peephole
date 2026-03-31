import { spawn } from "child_process";
import { getChatCliArgs, buildPromptWithHistory } from "./chat-context";

export interface ChatCliCallbacks {
  onDelta: (text: string) => void;
  onToolActivity: (name: string, input: Record<string, unknown>) => void;
  onComplete: (fullText: string, metadata: {
    totalCostUsd?: number;
    durationMs?: number;
    model?: string;
    sessionId?: string;
  }) => void | Promise<void>;
  onError: (error: Error) => void;
}

export interface SpawnedChat {
  kill: () => void;
}

/**
 * Spawn a Claude CLI subprocess for a single chat turn.
 * The CLI runs in --print mode and exits after producing a response.
 *
 * Uses spawn() with an args array (not exec/shell interpolation) so there
 * is no shell-injection risk — each argument is passed directly to execvp.
 */
export function spawnChatCli(
  userMessage: string,
  conversationHistory: { role: string; content: string }[],
  callbacks: ChatCliCallbacks
): SpawnedChat {
  const args = getChatCliArgs();

  // Add --include-partial-messages for streaming
  args.push("--include-partial-messages");

  // The prompt (with history context) goes as the positional argument
  const fullPrompt = buildPromptWithHistory(userMessage, conversationHistory);
  args.push(fullPrompt);

  // spawn() with an explicit args array — no shell, no injection risk
  const proc = spawn("claude", args, {
    cwd: process.env.HOME ?? "/tmp",
    env: { ...process.env, TERM: "dumb" },
    stdio: ["pipe", "pipe", "pipe"],
    shell: false,
  });

  let lastEmittedLength = 0;
  let accumulatedText = "";
  let killed = false;

  // Timeout: kill after 120 seconds
  const timeout = setTimeout(() => {
    if (!killed) {
      killed = true;
      proc.kill("SIGTERM");
      setTimeout(() => {
        try { proc.kill("SIGKILL"); } catch { /* already dead */ }
      }, 5000);
      callbacks.onError(new Error("Response timed out after 120 seconds"));
    }
  }, 120_000);

  // Parse stdout line-by-line
  let buffer = "";
  proc.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line) as Record<string, unknown>;
        const state = { lastEmittedLength, accumulatedText };
        void handleEvent(event, callbacks, state, (next) => {
          lastEmittedLength = next.lastEmittedLength;
          accumulatedText = next.accumulatedText;
        });
      } catch {
        // Skip unparseable lines (could be debug output)
      }
    }
  });

  // Handle remaining buffer on close
  proc.stdout.on("end", () => {
    if (buffer.trim()) {
      try {
        const event = JSON.parse(buffer) as Record<string, unknown>;
        const state = { lastEmittedLength, accumulatedText };
        handleEvent(event, callbacks, state, (next) => {
          lastEmittedLength = next.lastEmittedLength;
          accumulatedText = next.accumulatedText;
        });
      } catch { /* ignore */ }
    }
  });

  // Capture stderr
  let stderrOutput = "";
  proc.stderr.on("data", (chunk: Buffer) => {
    stderrOutput += chunk.toString();
  });

  proc.on("close", (code) => {
    clearTimeout(timeout);
    if (code !== 0 && code !== null && !killed) {
      callbacks.onError(
        new Error(`CLI exited with code ${code}: ${stderrOutput.slice(0, 500)}`)
      );
    }
  });

  proc.on("error", (err) => {
    clearTimeout(timeout);
    if (err.message.includes("ENOENT")) {
      callbacks.onError(new Error(
        "Claude CLI not found. Ensure 'claude' is installed and in your PATH."
      ));
    } else {
      callbacks.onError(err);
    }
  });

  // Close stdin immediately — the prompt is passed as a CLI argument
  proc.stdin.end();

  return {
    kill: () => {
      if (!killed) {
        killed = true;
        clearTimeout(timeout);
        proc.kill("SIGTERM");
      }
    },
  };
}

interface StreamState {
  lastEmittedLength: number;
  accumulatedText: string;
}

type ContentBlock = {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
};

type AssistantMessage = {
  content?: ContentBlock[];
  model?: string;
  usage?: Record<string, number>;
};

type ResultEvent = {
  result?: string;
  total_cost_usd?: number;
  duration_ms?: number;
  session_id?: string;
  is_error?: boolean;
};

async function handleEvent(
  event: Record<string, unknown>,
  callbacks: ChatCliCallbacks,
  state: StreamState,
  updateState: (s: StreamState) => void
): Promise<void> {
  const type = event.type as string;

  if (type === "system") {
    // Skip hook events and init events
    return;
  }

  if (type === "assistant") {
    const message = event.message as AssistantMessage | undefined;
    if (!message?.content) return;

    for (const block of message.content) {
      if (block.type === "text" && block.text) {
        // With --include-partial-messages, each assistant event has the FULL text so far.
        // We emit only the NEW portion as a delta.
        const fullText = block.text;
        if (fullText.length > state.lastEmittedLength) {
          const delta = fullText.slice(state.lastEmittedLength);
          callbacks.onDelta(delta);
          updateState({
            lastEmittedLength: fullText.length,
            accumulatedText: fullText,
          });
        }
      } else if (block.type === "tool_use" && block.name) {
        callbacks.onToolActivity(block.name, block.input ?? {});
      }
    }
  }

  if (type === "result") {
    const result = event as unknown as ResultEvent;

    if (result.is_error) {
      callbacks.onError(new Error(result.result ?? "Unknown CLI error"));
      return;
    }

    const fullText = result.result ?? state.accumulatedText;

    await callbacks.onComplete(fullText, {
      totalCostUsd: result.total_cost_usd,
      durationMs: result.duration_ms,
      sessionId: result.session_id,
    });
  }
}

/**
 * Parse accumulated text for config-change proposals.
 * Returns any proposals found and the text with proposals replaced by placeholders.
 */
export function extractConfigChangeProposals(text: string): {
  proposals: {
    action: "edit" | "create" | "delete";
    filePath: string;
    description: string;
    before: string;
    after: string;
  }[];
  cleanedText: string;
} {
  const proposals: {
    action: "edit" | "create" | "delete";
    filePath: string;
    description: string;
    before: string;
    after: string;
  }[] = [];

  const pattern = /```config-change\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let cleanedText = text;

  while ((match = pattern.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]) as {
        action?: "edit" | "create" | "delete";
        filePath?: string;
        description?: string;
        before?: string;
        after?: string;
      };
      if (parsed.action && parsed.filePath) {
        proposals.push({
          action: parsed.action,
          filePath: parsed.filePath,
          description: parsed.description ?? "",
          before: parsed.before ?? "",
          after: parsed.after ?? "",
        });
        // Replace the code block with a placeholder marker
        cleanedText = cleanedText.replace(
          match[0],
          `[CONFIG_CHANGE_PROPOSAL:${proposals.length - 1}]`
        );
      }
    } catch {
      // Invalid JSON in config-change block — leave as-is
    }
  }

  return { proposals, cleanedText };
}
