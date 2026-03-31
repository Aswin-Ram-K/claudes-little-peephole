import { homedir } from "os";
import { join, resolve } from "path";

const CLAUDE_HOME = process.env.CLAUDE_HOME || join(homedir(), ".claude");

// Paths the chat is allowed to read from and propose changes to
export const ALLOWED_PATHS = [
  CLAUDE_HOME,
  join(CLAUDE_HOME, "settings.json"),
  join(CLAUDE_HOME, "agents"),
  join(CLAUDE_HOME, "CLAUDE.md"),
];

// Tools the CLI can use (read-only — no Edit/Write)
const ALLOWED_TOOLS = "Read,Bash(cat:*,ls:*,head:*,tail:*,echo:*,grep:*,find:*)";

// System prompt scoping the assistant to config management
const SYSTEM_PROMPT = `You are a Claude Code configuration assistant running inside the Claude Master Portal. Your role is to help the user understand, inspect, and modify their Claude Code setup.

## Your Scope
You can read and analyze:
- ~/.claude/settings.json (Claude Code settings, hooks, permissions)
- ~/.claude/CLAUDE.md (global instructions)
- ~/.claude/agents/ (custom agents)
- Project-level CLAUDE.md files
- Hook scripts referenced in settings

## Making Changes
You have READ-ONLY tool access. When the user asks you to make a configuration change, you MUST propose the change using this exact format:

\`\`\`config-change
{
  "action": "edit",
  "filePath": "/absolute/path/to/file",
  "description": "Brief description of what this change does",
  "before": "the exact text being replaced (or empty string for new files)",
  "after": "the new text that should replace it"
}
\`\`\`

For creating new files, use action "create" with an empty "before" field.
For deleting files, use action "delete" with an empty "after" field.

The portal will show a diff preview to the user and apply the change only after they approve it.

## Guidelines
- Always read the current file content before proposing changes
- Show the user what you found before suggesting modifications
- Be precise with the before/after text — use exact matches from the file
- For JSON files like settings.json, ensure valid JSON in your proposal
- Never propose changes to files outside ~/.claude/ or project hook directories
- Explain what each change does and why`;

/**
 * Build CLI arguments for a chat subprocess
 */
export function getChatCliArgs(): string[] {
  return [
    "-p",
    "--output-format=stream-json",
    "--verbose",
    "--no-session-persistence",
    "--allowedTools", ALLOWED_TOOLS,
    "--system-prompt", SYSTEM_PROMPT,
    "--add-dir", CLAUDE_HOME,
  ];
}

/**
 * Check if a file path is within the allowed scope for modifications
 */
export function isPathInScope(filePath: string): boolean {
  const resolved = resolve(filePath);
  const claudeHome = resolve(CLAUDE_HOME);

  // Must be within ~/.claude/
  if (resolved.startsWith(claudeHome)) return true;

  // Also allow hook scripts that are referenced in settings
  // (these could be in project directories)
  return false;
}

/**
 * Build a prompt that includes conversation history for context
 */
export function buildPromptWithHistory(
  userMessage: string,
  history: { role: string; content: string }[]
): string {
  if (history.length === 0) return userMessage;

  // Include last 10 messages for context (keep prompt manageable)
  const recentHistory = history.slice(-10);

  const historyBlock = recentHistory
    .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
    .join("\n\n");

  return `<conversation_history>
${historyBlock}
</conversation_history>

${userMessage}`;
}
