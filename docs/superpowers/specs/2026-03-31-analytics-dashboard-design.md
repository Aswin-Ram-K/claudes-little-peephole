# Analytics & Dashboard Enhancement — Design Spec

**Date:** 2026-03-31
**Status:** Approved
**Scope:** New `/analytics` page + time range selector on dashboard + analytics API endpoint

## Context

The portal's dashboard shows flat stat cards and a recent activity timeline, but lacks trend visualizations, breakdowns, and time-scoped views. Users can't see how their Claude Code usage changes over time, which models consume the most tokens, or which repos are most active. Research into Vercel Analytics, Grafana, Linear Insights, and Railway's dashboard informed the feature set.

## 1. New Analytics Page (`/analytics`)

### Layout
Full-page view with sticky time range selector at top, 4 chart panels in a 2x2 grid, and an insights summary row below.

### Time Range Selector (shared component)
- Preset toggle buttons: `Today`, `7d`, `30d`, `90d`, `All`
- Stored in URL query params (`?range=7d`) for shareability
- Component: `<TimeRangeSelector value={range} onChange={setRange} />`
- Used on both `/analytics` and `/` (dashboard)

### Chart Panels

#### 1. Token Usage Over Time — Stacked Area Chart
- **X-axis:** Dates (day granularity for <=30d, week for >30d)
- **Y-axis:** Token count
- **Series:** Input tokens (indigo fill) + Output tokens (violet fill), stacked
- **Interaction:** Hover tooltip shows exact values, date
- **Data:** `tokenTrend[]` from analytics API

#### 2. Sessions Over Time — Stacked Bar Chart
- **X-axis:** Dates
- **Y-axis:** Session count
- **Series:** Top 5 repos by session count (distinct colors), rest grouped as "Other"
- **Interaction:** Hover tooltip with repo breakdown
- **Data:** `sessionTrend[]` from analytics API

#### 3. Token Distribution by Model — Donut Chart
- **Segments:** One per model (e.g., claude-opus-4-6, claude-sonnet-4-6)
- **Center:** Total token count formatted (e.g., "1.3M")
- **Legend:** Below chart with model name, token count, percentage
- **Data:** `modelBreakdown[]` from analytics API

#### 4. Top Repos by Token Usage — Horizontal Bar List
- **Rows:** Repos ranked by total tokens (input + output)
- **Bar:** Proportional width relative to top repo
- **Labels:** Repo name, token count, session count
- **Data:** `repoBreakdown[]` from analytics API

### Insights Row (below charts)
Four stat cards in a single row:
- **Avg Session Duration** — mean `durationSeconds` across range
- **Avg Tokens Per Session** — mean (input + output) per session
- **Peak Activity Hour** — hour of day with most sessions, displayed in 12h format (e.g., "2 PM")
- **Cache Hit Rate** — `cacheReadTokens / totalInputTokens` as percentage

## 2. Dashboard Enhancement (`/`)

### Time Range Selector
- Same `<TimeRangeSelector>` component added below page header
- Default: `Today` (preserves current behavior)

### Stats Cards — Time-Scoped
| Card | Current | Enhanced |
|------|---------|----------|
| Sessions Today | Fixed "today" | Scoped to selected range |
| Total Repos | All-time count | Unchanged (repos don't have time dimension) |
| Tokens Used | Today only | Scoped to selected range |
| Commits | This week | Scoped to selected range |

### Recent Activity
- Filters to sessions within selected range
- Falls back to latest 10 if range returns too many

## 3. API Changes

### New: `GET /api/analytics`
**Query params:**
- `range`: `today` | `7d` | `30d` | `90d` | `all` (default: `7d`)

**Response:**
```json
{
  "tokenTrend": [
    { "date": "2026-03-25", "inputTokens": 12000, "outputTokens": 8000 }
  ],
  "sessionTrend": [
    { "date": "2026-03-25", "count": 5, "repos": { "CLAUDE_MASTER": 3, "portal": 2 } }
  ],
  "modelBreakdown": [
    { "model": "claude-opus-4-6", "tokens": 800000, "sessions": 40 }
  ],
  "repoBreakdown": [
    { "repo": "Aswin-Ram-K/CLAUDE_MASTER", "tokens": 500000, "sessions": 9 }
  ],
  "insights": {
    "avgDuration": 1200,
    "avgTokensPerSession": 19500,
    "peakHour": 14,
    "cacheHitRate": 0.72
  }
}
```

**Implementation:** Prisma aggregation queries with `groupBy` and date truncation. For `tokenTrend` and `sessionTrend`, group by `DATE(startedAt)` (day granularity for ranges <=30d) or by ISO week (for 90d/all). The API handles granularity — the frontend always receives a flat array of data points. For `modelBreakdown`, group by `model`. For `repoBreakdown`, group by `repoOwner`/`repoName`.

### Updated: `GET /api/sessions`
- Add optional `range` query param
- When present, all stats (totalSessions, tokensToday, totalCommits, etc.) filter to the date range
- `recentSessions` filtered to range, capped at 10

## 4. New Files

| File | Purpose |
|------|---------|
| `src/app/analytics/page.tsx` | Analytics page with 4 chart panels + insights |
| `src/app/api/analytics/route.ts` | Analytics data aggregation endpoint |
| `src/components/shared/TimeRangeSelector.tsx` | Reusable time range toggle |
| `src/components/analytics/TokenTrendChart.tsx` | Stacked area chart (Recharts) |
| `src/components/analytics/SessionTrendChart.tsx` | Stacked bar chart (Recharts) |
| `src/components/analytics/ModelBreakdown.tsx` | Donut chart (Recharts) |
| `src/components/analytics/RepoBreakdown.tsx` | Horizontal bar list (Recharts) |
| `src/components/analytics/InsightsRow.tsx` | 4 insight stat cards |
| `src/hooks/useAnalytics.ts` | TanStack Query hook for analytics API |

## 5. Modified Files

| File | Change |
|------|--------|
| `src/app/page.tsx` | Add TimeRangeSelector, pass range to useDashboard |
| `src/app/api/sessions/route.ts` | Accept optional `range` query param |
| `src/hooks/useSessionLogs.ts` | Update useDashboard to accept range param |
| `src/components/layout/Sidebar.tsx` | Add Analytics nav item |
| `package.json` | Add `recharts` dependency |

## 6. Charting Library

**Recharts** — declarative React charts built on D3.
- `npm install recharts`
- Components: `AreaChart`, `BarChart`, `PieChart`, `ResponsiveContainer`, `Tooltip`, `Legend`
- Styled with Tailwind CSS variables mapped to Recharts color props

## 7. Theme Integration

Charts use existing theme tokens:
- Indigo (`#6366f1`) — input tokens, primary series
- Violet (`#8b5cf6`) — output tokens, secondary series
- Background: `#12121a` (card bg) for chart container
- Text: `text-text-secondary` for axis labels, `text-text-primary` for values
- Grid lines: `border-border-subtle` color

## 8. Data Considerations

- **Granularity:** Day-level for ranges <=30d, week-level for 90d/all to avoid chart clutter
- **Cache tokens:** Not stored in current schema (`inputTokens`/`outputTokens` only). Cache hit rate insight requires adding `cacheReadTokens` and `cacheCreationTokens` columns to SessionLog, or computing from `rawLog` JSON field at query time.
- **Decision:** Query from `rawLog` JSON for now (avoids migration). Add dedicated columns later if performance becomes an issue.

## 9. Sidebar Navigation

Add "Analytics" item to sidebar between "Dashboard" and "Activity":
- Icon: `BarChart3` from lucide-react
- Label: "Analytics"
- Route: `/analytics`
