import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, lstatSync, realpathSync } from "fs";
import { dirname } from "path";
import { prisma } from "@/lib/db";
import { isPathInScope } from "@/lib/chat-context";

export const dynamic = "force-dynamic";

interface ApplyRequestBody {
  messageId?: number;
  filePath: string;
  action: "edit" | "create" | "delete";
  before?: string;
  after?: string;
}

export async function POST(request: NextRequest) {
  const body = await request.json() as ApplyRequestBody;
  const { messageId, filePath, action, before = "", after = "" } = body;

  // Security: resolve symlinks before scope check to prevent traversal
  let resolvedPath = filePath;
  try {
    if (existsSync(filePath)) {
      const stat = lstatSync(filePath);
      if (stat.isSymbolicLink()) {
        resolvedPath = realpathSync(filePath);
      }
    }
  } catch {
    // If we can't stat it, proceed with the original path
  }

  if (!isPathInScope(resolvedPath)) {
    return NextResponse.json(
      { error: "File path is outside allowed scope" },
      { status: 403 }
    );
  }

  try {
    if (action === "edit") {
      if (!existsSync(filePath)) {
        return NextResponse.json(
          { error: "File does not exist" },
          { status: 404 }
        );
      }

      const currentContent = readFileSync(filePath, "utf-8");

      if (before && !currentContent.includes(before)) {
        return NextResponse.json(
          {
            error:
              "File content has changed since the proposal was made. The 'before' text no longer matches.",
          },
          { status: 409 }
        );
      }

      // Verify the 'before' text matches exactly once to avoid ambiguous replacements
      if (before) {
        const occurrences = currentContent.split(before).length - 1;
        if (occurrences > 1) {
          return NextResponse.json(
            { error: `The 'before' text matches ${occurrences} locations in the file. Please provide a more specific match.` },
            { status: 409 }
          );
        }
      }
      const newContent = before ? currentContent.replace(before, after) : after;
      writeFileSync(filePath, newContent, "utf-8");
    } else if (action === "create") {
      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(filePath, after, "utf-8");
    } else if (action === "delete") {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } else {
      return NextResponse.json(
        { error: `Unknown action: ${action as string}` },
        { status: 400 }
      );
    }

    // Update message metadata to record the approval
    if (messageId) {
      const msg = await prisma.chatMessage.findUnique({ where: { id: messageId } });
      if (msg) {
        const metadata = (msg.metadata as Record<string, unknown>) ?? {};
        const proposals = (
          metadata.configChangeProposals as Array<Record<string, unknown>>
        ) ?? [];
        const updatedProposals = proposals.map((p) =>
          p.filePath === filePath ? { ...p, approvalStatus: "approved" } : p
        );
        await prisma.chatMessage.update({
          where: { id: messageId },
          data: { metadata: JSON.parse(JSON.stringify({ ...metadata, configChangeProposals: updatedProposals })) },
        });
      }
    }

    return NextResponse.json({ success: true, filePath, action });
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to apply change: ${errMessage}` },
      { status: 500 }
    );
  }
}
