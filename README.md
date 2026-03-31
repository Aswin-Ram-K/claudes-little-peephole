# Claude Master Portal

**Status:** `prototyping`

## Idea

A visually stunning, Dockerized web portal that serves as the centralized hub for your entire Claude Code experience. It connects to the [claude-master](https://github.com/Aswin-Ram-K/claude-master) repo — your replicable Claude Code snapshot — and provides real-time activity tracking, session history, live instance monitoring, and a scoped chat interface for managing your Claude Code configuration.

## Features

### Session Activity Logging
Track every Claude Code session across all your GitHub repos. Log files (`.claude-logs/`) are maintained in each respective repo but pulled and displayed centrally in the portal. Captures: summary, files changed, commits, token usage, tools used, and more.

### Activity History Dashboard
Aggregated view of all Claude Code activity across your GitHub repos. Stats cards, timeline, repo grid, filterable/sortable tables with all session metadata.

### Live Instance Monitoring
Real-time tracking of active Claude Code sessions: token usage gauges, runtime timers, system info, current context overview. Polled every 5 seconds.

### Scoped Chat Interface
Interactive chat powered by Claude Code CLI (works with Claude Max — no API key needed). Scoped to Claude Code setup, hooks, settings, skills, and automations. Read + write with approval dialogs for config changes.

### Cross-Platform Desktop Launcher
One-click desktop shortcuts for Linux, macOS, and Windows. Auto-starts Docker containers and opens the portal in your browser.

### Auto-Start with Claude Code
SessionStart hook automatically starts the portal whenever any Claude Code CLI session begins. Runs async so it never blocks your session startup.

## Architecture

```
Docker Compose
┌──────────┬──────────┬──────────┬────────────┐
│  nginx   │  portal  │ postgres │   redis    │
│  :80     │  :3000   │  :5432   │   :6379    │
│  proxy   │  Next.js │  data    │  realtime  │
└──────────┴──────────┴──────────┴────────────┘
```

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Framer Motion, Prisma, PostgreSQL, Redis, Docker

## Quick Start

```bash
# Auto-setup (recommended)
chmod +x hooks/auto-setup.sh
./hooks/auto-setup.sh

# Or manual
cp .env.example .env        # Edit with your credentials
docker compose up -d --build
```

Open http://localhost

## Manual Setup

See [docs/setup.md](docs/setup.md) for detailed step-by-step instructions covering:
- Prerequisites and environment setup
- Docker container configuration
- Desktop shortcut installation
- Auto-start hook registration
- Session logging hook setup
- Troubleshooting guide

## Implementation Phases

- [x] **Phase 1**: Foundation — Docker, Next.js, dark UI, sidebar, placeholder pages, launchers, auto-start hook
- [x] **Phase 2**: Session Logging — JSONL parser, log generator, stop hook integration
- [x] **Phase 3**: Dashboard + Activity — GitHub sync, stats, timeline, repo detail, pagination
- [x] **Phase 4**: Live Monitoring — PID detection, token gauges, cache stats, real-time 5s polling
- [x] **Phase 5**: Chat Interface — Claude Code CLI subprocess, streaming, approval dialogs, config diff preview
- [ ] **Phase 6**: Polish — Animations, responsive, search, settings page

## Notes

- Created 2026-03-31
- Depends on [claude-master](https://github.com/Aswin-Ram-K/claude-master) as source of truth for configuration
- Uses Claude Max 20x subscription (not API keys) for the chat feature
- All pages are fully responsive from 320px mobile to 4K ultrawide
