# Claude Master Portal — Project Context

## Current State

**Branch:** `main`
**Phases 1–4 complete. Phase 5 is next.**

## Architecture

```
claude-master-portal/
├── docker-compose.yml          # Production: portal + postgres + redis + nginx
├── docker-compose.dev.yml      # Dev overrides: hot reload, exposed ports, no nginx
├── nginx/nginx.conf            # Reverse proxy, WebSocket/SSE support
├── hooks/
│   ├── auto-setup.sh           # One-command full setup
│   ├── session-start-portal.sh # SessionStart hook (async, idempotent)
│   └── stop-session-log.sh     # SessionStop hook for log generation
├── launcher/
│   ├── portal.sh               # Core launcher (cross-platform)
│   ├── install.sh              # Desktop shortcut installer
│   └── windows/                # PowerShell launcher
├── docs/setup.md               # 9-step manual setup guide
└── portal/
    ├── Dockerfile / Dockerfile.dev
    ├── prisma/schema.prisma    # SessionLog, Repo, ChatMessage models
    ├── scripts/generate-session-log.ts
    └── src/
        ├── app/
        │   ├── layout.tsx      # Root: Providers + Sidebar + TopBar
        │   ├── globals.css     # Custom theme classes
        │   ├── page.tsx        # Dashboard (stats, timeline, latest session)
        │   ├── activity/       # Paginated session history table
        │   ├── live/           # Real-time instance monitoring (5s poll)
        │   ├── repos/          # Repo grid + [owner]/[repo] detail
        │   ├── chat/           # Chat UI (placeholder — Phase 5)
        │   └── api/
        │       ├── sync/       # POST: parse local JSONL + GitHub .claude-logs/
        │       ├── sessions/   # GET: dashboard stats
        │       ├── sessions/active/ # GET: live PID-checked sessions
        │       ├── activity/   # GET: paginated history
        │       ├── repos/      # GET: repo list + [owner]/[repo]/logs detail
        │       ├── config/     # GET: ~/.claude/settings.json
        │       └── health/     # GET: status check
        ├── components/
        │   ├── layout/         # Sidebar, TopBar, PageTransition
        │   └── shared/         # Badge, LoadingSkeleton, EmptyState
        ├── hooks/
        │   ├── useSessionLogs.ts    # useDashboard, useActivity, useRepos, useSync
        │   └── useActiveSessions.ts # 5s polling for live instances
        ├── lib/
        │   ├── session-parser.ts  # Parses Claude Code JSONL transcripts
        │   ├── log-generator.ts   # Creates .claude-logs/ entries per repo
        │   ├── active-sessions.ts # PID liveness + JSONL tail for live data
        │   ├── github.ts          # Octokit: repo list, .claude-logs/ fetch
        │   ├── claude-local.ts    # Reads ~/.claude/ sessions/settings/projects
        │   ├── db.ts              # Prisma singleton
        │   ├── redis.ts           # ioredis singleton
        │   └── utils.ts           # cn, formatDuration, formatTokenCount, etc.
        └── types/
            ├── session.ts
            ├── activity.ts
            └── config.ts
```

## Tech Stack

- Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion
- TanStack Query for server state + polling
- Prisma ORM + PostgreSQL, Redis (Phase 5+)
- Docker Compose (4 containers), Nginx reverse proxy
- Octokit for GitHub API, Claude Code CLI subprocess for chat (Phase 5)

## Theme

- Background: `#0a0a0f`, cards: `#12121a`, accent: indigo→violet gradient
- Fonts: Inter (UI), JetBrains Mono (code/numbers)
- Custom classes: glass-card, gradient-text, gradient-border, shimmer, glow-hover

## Phase 5 — Chat Interface (COMPLETE)

Scoped chat interface powered by Claude CLI subprocess.

### Architecture
- **Read-only CLI + portal-side writes**: CLI spawns with `--allowedTools "Read,Bash(cat:*,ls:*,...)"` — no Edit/Write. For config changes, the system prompt instructs Claude to output structured `config-change` proposals. The portal parses these, shows a diff preview, and applies approved changes via Node.js `fs`.
- **Dev mode**: Portal runs on host (`npm run dev`) for CLI access. Postgres/Redis in Docker.
- **Streaming**: CLI → stream-json stdout → SSE API route → fetch ReadableStream on client
- **Persistence**: ChatMessage model with conversationId, metadata (cost/duration/proposals), stored in PostgreSQL. Conversation ID in localStorage for continuity.

### Files
- `src/lib/chat-context.ts` — Scope definition, CLI args, system prompt, `isPathInScope()` security check
- `src/lib/chat-cli.ts` — `spawnChatCli()` subprocess manager, `extractConfigChangeProposals()` parser
- `src/app/api/chat/route.ts` — POST SSE streaming endpoint
- `src/app/api/chat/apply/route.ts` — POST apply approved config changes (with scope validation)
- `src/app/api/chat/history/route.ts` — GET conversation history
- `src/hooks/useChat.ts` — Client-side chat state, SSE consumption, approval flow
- `src/components/chat/StreamingText.tsx` — Streaming markdown renderer with syntax highlighting
- `src/components/chat/ConfigDiffPreview.tsx` — Side-by-side before/after diff view
- `src/components/chat/ApprovalDialog.tsx` — Radix UI approval dialog with diff preview
- `src/types/chat.ts` — TypeScript types for the chat system

## Key Design Decisions

- All API routes use `export const dynamic = "force-dynamic"` (Prisma/fs at runtime)
- Session filenames use full sessionId (not short prefix) to avoid collisions
- Commit extraction handles heredoc format: `<<'EOF'\n...\nEOF`
- Active session detection: read ~/.claude/sessions/*.json → check PID with process.kill(pid, 0) → tail JSONL for tokens/context
- The portal container mounts ~/.claude as read-only volume
- No API keys needed — Claude Max subscription handles everything via CLI

## Important Patterns

- Hooks: `useQuery` with `refetchInterval` (5s live, 30s dashboard, 60s repos)
- All pages use `<PageTransition>` wrapper (Framer Motion fade+slide)
- Responsive: 1-col mobile → 2-col tablet → 4-col desktop grid patterns
- Sidebar collapses to 60px icons on mobile, 240px expanded on desktop
