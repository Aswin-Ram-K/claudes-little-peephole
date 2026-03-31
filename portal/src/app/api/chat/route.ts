import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { spawnChatCli, extractConfigChangeProposals, type SpawnedChat } from "@/lib/chat-cli";
import type { ChatSSEEvent } from "@/types/chat";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const body = await request.json() as { message?: string; conversationId?: string };
  const message: string = body.message ?? "";
  const conversationId: string = body.conversationId ?? randomUUID();

  if (!message.trim()) {
    return new Response(JSON.stringify({ error: "Message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Persist user message
  await prisma.chatMessage.create({
    data: {
      conversationId,
      role: "user",
      content: message.trim(),
    },
  });

  // Load conversation history EXCLUDING the message we just saved
  // to avoid duplicating it in the CLI prompt (it's also the positional arg)
  const allHistory = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
    take: 20,
  });
  // Remove the last entry (the user message we just inserted)
  const history = allHistory.slice(0, -1);

  // Create SSE stream
  const encoder = new TextEncoder();
  let chatProc: SpawnedChat | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (event: ChatSSEEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          // Stream may have been closed by the client
        }
      };

      // Send the conversationId first so the client can track this session
      sendEvent({ type: "delta", text: "", conversationId });

      chatProc = spawnChatCli(
        message.trim(),
        history.map((h) => ({ role: h.role, content: h.content })),
        {
          onDelta(text) {
            sendEvent({ type: "delta", text });
          },

          onToolActivity(name, input) {
            sendEvent({ type: "tool_activity", name, input });
          },

          async onComplete(fullText, metadata) {
            // Check for config change proposals embedded in the response
            const { proposals } = extractConfigChangeProposals(fullText);

            // Send each proposal as a separate event so the UI can render approval UI
            for (const proposal of proposals) {
              sendEvent({
                type: "config_change",
                proposal: { ...proposal, approvalStatus: "pending" },
              });
            }

            // Persist assistant message
            const assistantMsg = await prisma.chatMessage.create({
              data: {
                conversationId,
                role: "assistant",
                content: fullText,
                metadata: JSON.parse(JSON.stringify({
                  totalCostUsd: metadata.totalCostUsd,
                  durationMs: metadata.durationMs,
                  model: metadata.model,
                  configChangeProposals: proposals.length > 0 ? proposals : undefined,
                })),
                cliSessionId: metadata.sessionId,
              },
            });

            sendEvent({
              type: "done",
              fullText,
              messageId: assistantMsg.id,
              conversationId,
              metadata: {
                totalCostUsd: metadata.totalCostUsd,
                durationMs: metadata.durationMs,
                model: metadata.model,
              },
            });

            controller.close();
          },

          onError(error) {
            sendEvent({
              type: "error",
              message: error.message,
            });
            controller.close();
          },
        }
      );
    },

    cancel() {
      // Client disconnected — kill the CLI subprocess immediately
      chatProc?.kill();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
