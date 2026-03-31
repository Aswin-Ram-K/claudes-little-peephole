# Claude Master Portal — Project Context

## Current State

**Branch:** `main`
**Phases 1–6 complete. Phase 6 added analytics & dashboard enhancements.**

### Dev Mode Setup
- Docker Desktop required (postgres + redis in containers)
- Portal runs on host: `cd portal && npm run dev` (port 3000)
- DB: `postgresql://portal:portal@localhost:5433/claude_portal`
- Redis: `redis://localhost:6380`
- Desktop shortcut: `~/Desktop/Claude Portal.app`
- Dev launcher: `launcher/portal-dev.sh`

### Hooks Registered
- **SessionStart**: `hooks/session-start-portal.sh` — auto-starts DB containers
- **Stop**: `hooks/stop-session-log.sh` — generates `.claude-logs/` entries in repos
- Session logs sync to `~/CLAUDE_MASTER/SESSION_LOGS/` via `/sync` (Step 9 in sync.sh)

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
        │   ├── page.tsx        # Dashboard (stats, timeline, latest session) + time range
        │   ├── analytics/      # Analytics page (trend charts, breakdowns, insights)
        │   ├── activity/       # Paginated session history table
        │   ├── live/           # Real-time instance monitoring (5s poll)
        │   ├── repos/          # Repo grid + [owner]/[repo] detail
        │   ├── chat/           # Chat UI (Phase 5)
        │   └── api/
        │       ├── sync/       # POST: parse local JSONL + GitHub .claude-logs/
        │       ├── sessions/   # GET: dashboard stats (supports ?range=)
        │       ├── sessions/active/ # GET: live PID-checked sessions
        │       ├── analytics/  # GET: token trends, session trends, breakdowns
        │       ├── activity/   # GET: paginated history
        │       ├── repos/      # GET: repo list + [owner]/[repo]/logs detail
        │       ├── config/     # GET: ~/.claude/settings.json
        │       └── health/     # GET: status check
        ├── components/
        │   ├── layout/         # Sidebar, TopBar, PageTransition
        │   ├── shared/         # Badge, LoadingSkeleton, EmptyState, TimeRangeSelector
        │   └── analytics/      # TokenTrendChart, SessionTrendChart, ModelBreakdown, RepoBreakdown, InsightsRow
        ├── hooks/
        │   ├── useSessionLogs.ts    # useDashboard (with range), useActivity, useRepos, useSync
        │   ├── useAnalytics.ts      # useAnalytics hook for analytics API
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
            ├── analytics.ts    # TimeRange, AnalyticsData, chart data types
            └── config.ts
```

## Tech Stack

- Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion
- TanStack Query for server state + polling
- Recharts for analytics visualizations (area, bar, pie charts)
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

## Phase 6 — Analytics & Dashboard Enhancements (COMPLETE)

### Sync Fix
- **Bug:** Workspace path decoder (`-Users-aswinram-CLAUDE-MASTER` → broken path) was lossy — hyphens in dir names were indistinguishable from path separators. Zero sessions were being indexed.
- **Fix:** Use `parsed.cwd` from JSONL transcripts (ground truth) instead of decoding workspace names. Added `createFallbackSlug()` for non-git directories (`local/<dirname>`).

### Analytics Page (`/analytics`)
- 4 Recharts panels: stacked area (token trend), stacked bar (session trend by repo), donut (model breakdown), horizontal bar list (repo breakdown)
- Insights row: avg duration, avg tokens/session, peak hour, cache hit rate
- Time range selector (Today/7d/30d/90d/All) shared with dashboard
- New `GET /api/analytics?range=` endpoint with Prisma raw SQL aggregations (`Prisma.sql` + `Prisma.empty` for conditional WHERE)
- Cache hit rate computed from `rawLog->>'cacheReadTokens'` JSON extraction (no schema migration needed)

### Dashboard Enhancement
- Added `TimeRangeSelector` to dashboard page
- `GET /api/sessions` now accepts optional `?range=` query param
- Stats scope to selected range; default is "today" (preserves legacy behavior)

## Key Design Decisions

- All API routes use `export const dynamic = "force-dynamic"` (Prisma/fs at runtime)
- Session filenames use full sessionId (not short prefix) to avoid collisions
- Commit extraction handles heredoc format: `<<'EOF'\n...\nEOF`
- Active session detection: read ~/.claude/sessions/*.json → check PID with process.kill(pid, 0) → tail JSONL for tokens/context
- The portal container mounts ~/.claude as read-only volume
- No API keys needed — Claude Max subscription handles everything via CLI
- Sync uses `parsed.cwd` from JSONL (not workspace dir name decoding) — workspace encoding is lossy
- Non-git sessions tracked under `local/<dirname>` fallback slug
- Analytics raw SQL uses `Prisma.sql` fragments with `Prisma.empty` for conditional WHERE — avoids nested `$queryRaw` anti-pattern
- Cache hit rate queried from `rawLog` JSON field to avoid schema migration

## Important Patterns

- Hooks: `useQuery` with `refetchInterval` (5s live, 30s dashboard, 60s repos, 60s analytics)
- All pages use `<PageTransition>` wrapper (Framer Motion fade+slide)
- Responsive: 1-col mobile → 2-col tablet → 4-col desktop grid patterns
- Sidebar collapses to 60px icons on mobile, 240px expanded on desktop
