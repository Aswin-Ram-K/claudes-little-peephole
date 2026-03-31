import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, basename } from "path";
import { ParsedSession } from "./session-parser";

export interface SessionLogEntry {
  version: "1.0";
  sessionId: string;
  repo: string | null;
  branch: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  entrypoint: string | null;
  model: string | null;
  claudeCodeVersion: string | null;
  summary: string;
  userMessages: string[];
  filesChanged: string[];
  commits: { sha: string | null; message: string; timestamp: string | null }[];
  tokenUsage: {
    totalInputTokens: number;
    totalOutputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
  };
  toolsUsed: string[];
  subagents: { type: string; description: string }[];
}

/**
 * Converts a ParsedSession into the .claude-logs/ JSON format.
 */
export function createLogEntry(
  parsed: ParsedSession,
  repoSlug: string | null
): SessionLogEntry {
  return {
    version: "1.0",
    sessionId: parsed.sessionId,
    repo: repoSlug,
    branch: parsed.gitBranch,
    startedAt: parsed.startedAt,
    endedAt: parsed.endedAt,
    durationSeconds: parsed.durationSeconds,
    entrypoint: parsed.entrypoint,
    model: parsed.model,
    claudeCodeVersion: parsed.version,
    summary: parsed.summary,
    userMessages: parsed.userMessages,
    filesChanged: parsed.filesChanged,
    commits: parsed.commits,
    tokenUsage: {
      totalInputTokens: parsed.tokenUsage.inputTokens,
      totalOutputTokens: parsed.tokenUsage.outputTokens,
      cacheCreationTokens: parsed.tokenUsage.cacheCreationTokens,
      cacheReadTokens: parsed.tokenUsage.cacheReadTokens,
    },
    toolsUsed: parsed.toolsUsed,
    subagents: parsed.subagents,
  };
}

/**
 * Writes a session log entry to .claude-logs/ in the given repo directory.
 * Returns the path of the written file.
 */
export function writeLogToRepo(
  repoDir: string,
  entry: SessionLogEntry
): string {
  const logsDir = join(repoDir, ".claude-logs");

  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
    // Write a README explaining the format
    writeFileSync(
      join(logsDir, "README.md"),
      `# .claude-logs

Auto-generated session logs from [Claude Master Portal](https://github.com/Aswin-Ram-K/claude-master-portal).

Each JSON file represents a single Claude Code session run in this repository, capturing:
- Session summary and user messages
- Files changed and commits made
- Token usage (input, output, cache)
- Tools used and subagents spawned
- Timestamps, model, and entrypoint

These logs are committed to the repo for version-controlled history and are pulled by the portal for the activity dashboard.

**Format version:** 1.0
`
    );
  }

  // Filename: YYYY-MM-DD-<sessionId>.json
  const date = entry.startedAt
    ? new Date(entry.startedAt).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];
  const filename = `${date}-${entry.sessionId}.json`;
  const filepath = join(logsDir, filename);

  writeFileSync(filepath, JSON.stringify(entry, null, 2) + "\n");

  return filepath;
}

/**
 * Detects the GitHub repo slug (owner/name) from a git remote URL.
 */
export function detectRepoSlug(repoDir: string): string | null {
  try {
    const { execSync } = require("child_process");
    const remoteUrl = execSync("git -C " + JSON.stringify(repoDir) + " remote get-url origin", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    // Parse: https://github.com/owner/repo.git or git@github.com:owner/repo.git
    const httpsMatch = remoteUrl.match(
      /github\.com\/([^/]+)\/([^/.]+)/
    );
    if (httpsMatch) return `${httpsMatch[1]}/${httpsMatch[2]}`;

    const sshMatch = remoteUrl.match(
      /github\.com:([^/]+)\/([^/.]+)/
    );
    if (sshMatch) return `${sshMatch[1]}/${sshMatch[2]}`;

    // Generic git remote — extract last two path segments
    const genericMatch = remoteUrl.match(
      /\/([^/]+)\/([^/.]+?)(?:\.git)?$/
    );
    if (genericMatch) return `${genericMatch[1]}/${genericMatch[2]}`;
  } catch {
    // Not a git repo or no remote
  }
  return null;
}

/**
 * Creates a fallback slug for non-git directories.
 * Returns "local/<basename>" so sessions are still tracked.
 */
export function createFallbackSlug(cwd: string | null, workspace: string): string {
  if (cwd) {
    const name = basename(cwd);
    return `local/${name || "home"}`;
  }
  const cleaned = workspace.replace(/^-/, "").replace(/-/g, "_");
  return `local/${cleaned || "unknown"}`;
}

/**
 * Resolves the JSONL transcript path for a given session.
 */
export function resolveJsonlPath(
  claudeHome: string,
  workspace: string,
  sessionId: string
): string | null {
  // Claude stores projects as: ~/.claude/projects/<encoded-workspace>/<sessionId>.jsonl
  // The workspace path is encoded with dashes replacing slashes
  const encodedWorkspace = workspace.replace(/\//g, "-");
  const candidates = [
    join(claudeHome, "projects", encodedWorkspace, `${sessionId}.jsonl`),
    // Also try without leading dash
    join(
      claudeHome,
      "projects",
      encodedWorkspace.replace(/^-/, ""),
      `${sessionId}.jsonl`
    ),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
