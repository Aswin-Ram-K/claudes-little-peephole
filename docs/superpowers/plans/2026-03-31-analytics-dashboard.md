# Analytics & Dashboard Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full analytics page with trend charts, model/repo breakdowns, and insights — plus a time range selector on both the analytics and dashboard pages.

**Architecture:** New `/analytics` page with 4 Recharts panels (stacked area, stacked bar, donut, horizontal bar list) served by a new `GET /api/analytics` endpoint that runs Prisma aggregation queries. A shared `<TimeRangeSelector>` component controls date filtering on both `/analytics` and `/` (dashboard). The existing `GET /api/sessions` endpoint gains an optional `range` query param.

**Tech Stack:** Next.js 14 App Router, TypeScript, Recharts (already installed), date-fns (already installed), Prisma ORM, TanStack Query, Tailwind CSS

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/components/shared/TimeRangeSelector.tsx` | Reusable time range toggle (Today/7d/30d/90d/All) |
| `src/app/api/analytics/route.ts` | Analytics aggregation endpoint |
| `src/hooks/useAnalytics.ts` | TanStack Query hook for analytics API |
| `src/types/analytics.ts` | TypeScript types for analytics data |
| `src/app/analytics/page.tsx` | Analytics page layout with 4 chart panels + insights |
| `src/components/analytics/TokenTrendChart.tsx` | Stacked area chart (input + output tokens over time) |
| `src/components/analytics/SessionTrendChart.tsx` | Stacked bar chart (sessions over time by repo) |
| `src/components/analytics/ModelBreakdown.tsx` | Donut chart (token distribution by model) |
| `src/components/analytics/RepoBreakdown.tsx` | Horizontal bar list (top repos by tokens) |
| `src/components/analytics/InsightsRow.tsx` | 4 insight stat cards |

### Modified Files
| File | Change |
|------|--------|
| `src/components/layout/Sidebar.tsx` | Add Analytics nav item between Dashboard and Activity |
| `src/types/activity.ts` | Add `sessionsInRange` and `tokensInRange` to DashboardStats |
| `src/hooks/useSessionLogs.ts` | Update `useDashboard` to accept `range` param |
| `src/app/api/sessions/route.ts` | Accept optional `range` query param for time-scoped stats |
| `src/app/page.tsx` | Add TimeRangeSelector, pass range to useDashboard |

---

### Task 1: Analytics Types

**Files:**
- Create: `portal/src/types/analytics.ts`

- [ ] **Step 1: Create types file**

```typescript
// portal/src/types/analytics.ts

export type TimeRange = "today" | "7d" | "30d" | "90d" | "all";

export interface TokenTrendPoint {
  date: string;
  inputTokens: number;
  outputTokens: number;
}

export interface SessionTrendPoint {
  date: string;
  count: number;
  repos: Record<string, number>;
}

export interface ModelBreakdownEntry {
  model: string;
  tokens: number;
  sessions: number;
}

export interface RepoBreakdownEntry {
  repo: string;
  tokens: number;
  sessions: number;
}

export interface AnalyticsInsights {
  avgDuration: number;
  avgTokensPerSession: number;
  peakHour: number;
  cacheHitRate: number;
}

export interface AnalyticsData {
  tokenTrend: TokenTrendPoint[];
  sessionTrend: SessionTrendPoint[];
  modelBreakdown: ModelBreakdownEntry[];
  repoBreakdown: RepoBreakdownEntry[];
  insights: AnalyticsInsights;
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/types/analytics.ts
git commit -m "feat(analytics): add TypeScript types for analytics data"
```

---

### Task 2: Time Range Selector Component

**Files:**
- Create: `portal/src/components/shared/TimeRangeSelector.tsx`

- [ ] **Step 1: Create the component**

```tsx
// portal/src/components/shared/TimeRangeSelector.tsx
"use client";

import { cn } from "@/lib/utils";
import type { TimeRange } from "@/types/analytics";

const ranges: { value: TimeRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "all", label: "All" },
];

export function TimeRangeSelector({
  value,
  onChange,
}: {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-bg-surface border border-border-subtle">
      {ranges.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200",
            value === r.value
              ? "bg-accent-indigo text-white shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-card"
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/components/shared/TimeRangeSelector.tsx
git commit -m "feat(analytics): add TimeRangeSelector component"
```

---

### Task 3: Analytics API Endpoint

**Files:**
- Create: `portal/src/app/api/analytics/route.ts`

- [ ] **Step 1: Create the analytics API route**

This is the core aggregation endpoint. It uses raw SQL via Prisma's `$queryRaw` for `GROUP BY DATE()` aggregations that Prisma's query builder can't express.

```typescript
// portal/src/app/api/analytics/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { TimeRange } from "@/types/analytics";

export const dynamic = "force-dynamic";

function getDateRange(range: TimeRange): Date | null {
  if (range === "all") return null;
  const now = new Date();
  const start = new Date(now);
  switch (range) {
    case "today":
      start.setHours(0, 0, 0, 0);
      break;
    case "7d":
      start.setDate(start.getDate() - 7);
      break;
    case "30d":
      start.setDate(start.getDate() - 30);
      break;
    case "90d":
      start.setDate(start.getDate() - 90);
      break;
  }
  return start;
}

export async function GET(req: NextRequest) {
  const range = (req.nextUrl.searchParams.get("range") ?? "7d") as TimeRange;
  const startDate = getDateRange(range);
  const where = startDate ? { startedAt: { gte: startDate } } : {};

  // Token trend — group by date
  const tokenTrendRaw = await prisma.$queryRaw<
    { date: string; input_tokens: bigint; output_tokens: bigint }[]
  >`
    SELECT
      TO_CHAR("startedAt", 'YYYY-MM-DD') as date,
      COALESCE(SUM("inputTokens"), 0) as input_tokens,
      COALESCE(SUM("outputTokens"), 0) as output_tokens
    FROM session_logs
    ${startDate ? prisma.$queryRaw`WHERE "startedAt" >= ${startDate}` : prisma.$queryRaw``}
    GROUP BY TO_CHAR("startedAt", 'YYYY-MM-DD')
    ORDER BY date ASC
  `;

  const tokenTrend = tokenTrendRaw.map((r) => ({
    date: r.date,
    inputTokens: Number(r.input_tokens),
    outputTokens: Number(r.output_tokens),
  }));

  // Session trend — group by date and repo
  const sessionTrendRaw = await prisma.$queryRaw<
    { date: string; repo_name: string; count: bigint }[]
  >`
    SELECT
      TO_CHAR("startedAt", 'YYYY-MM-DD') as date,
      "repoName" as repo_name,
      COUNT(*) as count
    FROM session_logs
    ${startDate ? prisma.$queryRaw`WHERE "startedAt" >= ${startDate}` : prisma.$queryRaw``}
    GROUP BY TO_CHAR("startedAt", 'YYYY-MM-DD'), "repoName"
    ORDER BY date ASC
  `;

  // Pivot session trend: group repos per date
  const sessionMap = new Map<string, { count: number; repos: Record<string, number> }>();
  for (const row of sessionTrendRaw) {
    if (!sessionMap.has(row.date)) {
      sessionMap.set(row.date, { count: 0, repos: {} });
    }
    const entry = sessionMap.get(row.date)!;
    const c = Number(row.count);
    entry.count += c;
    entry.repos[row.repo_name] = c;
  }
  const sessionTrend = Array.from(sessionMap.entries()).map(([date, data]) => ({
    date,
    count: data.count,
    repos: data.repos,
  }));

  // Model breakdown
  const modelBreakdownRaw = await prisma.sessionLog.groupBy({
    by: ["model"],
    where,
    _sum: { inputTokens: true, outputTokens: true },
    _count: true,
  });

  const modelBreakdown = modelBreakdownRaw
    .filter((r) => r.model)
    .map((r) => ({
      model: r.model!,
      tokens: (r._sum.inputTokens ?? 0) + (r._sum.outputTokens ?? 0),
      sessions: r._count,
    }))
    .sort((a, b) => b.tokens - a.tokens);

  // Repo breakdown
  const repoBreakdownRaw = await prisma.sessionLog.groupBy({
    by: ["repoOwner", "repoName"],
    where,
    _sum: { inputTokens: true, outputTokens: true },
    _count: true,
  });

  const repoBreakdown = repoBreakdownRaw
    .map((r) => ({
      repo: `${r.repoOwner}/${r.repoName}`,
      tokens: (r._sum.inputTokens ?? 0) + (r._sum.outputTokens ?? 0),
      sessions: r._count,
    }))
    .sort((a, b) => b.tokens - a.tokens);

  // Insights
  const [aggregates, sessionCount, peakHourRaw] = await Promise.all([
    prisma.sessionLog.aggregate({
      where,
      _avg: { durationSeconds: true, inputTokens: true, outputTokens: true },
    }),
    prisma.sessionLog.count({ where }),
    prisma.$queryRaw<{ hour: number; count: bigint }[]>`
      SELECT EXTRACT(HOUR FROM "startedAt") as hour, COUNT(*) as count
      FROM session_logs
      ${startDate ? prisma.$queryRaw`WHERE "startedAt" >= ${startDate}` : prisma.$queryRaw``}
      GROUP BY EXTRACT(HOUR FROM "startedAt")
      ORDER BY count DESC
      LIMIT 1
    `,
  ]);

  const avgTokensPerSession =
    (aggregates._avg.inputTokens ?? 0) + (aggregates._avg.outputTokens ?? 0);

  // Cache hit rate from rawLog JSON — sample approach
  const cacheData = await prisma.$queryRaw<
    { cache_read: bigint; total_input: bigint }[]
  >`
    SELECT
      COALESCE(SUM(("rawLog"->>'cacheReadTokens')::int), 0) as cache_read,
      COALESCE(SUM("inputTokens"), 0) as total_input
    FROM session_logs
    ${startDate ? prisma.$queryRaw`WHERE "startedAt" >= ${startDate}` : prisma.$queryRaw``}
  `;

  const cacheRead = Number(cacheData[0]?.cache_read ?? 0);
  const totalInput = Number(cacheData[0]?.total_input ?? 0);
  const cacheHitRate = totalInput > 0 ? cacheRead / totalInput : 0;

  return NextResponse.json({
    tokenTrend,
    sessionTrend,
    modelBreakdown,
    repoBreakdown,
    insights: {
      avgDuration: Math.round(aggregates._avg.durationSeconds ?? 0),
      avgTokensPerSession: Math.round(avgTokensPerSession),
      peakHour: peakHourRaw.length > 0 ? Number(peakHourRaw[0].hour) : 0,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
    },
  });
}
```

- [ ] **Step 2: Verify endpoint starts without errors**

Run: `cd portal && npm run dev` then `curl -s http://localhost:3000/api/analytics?range=7d | python3 -m json.tool | head -20`

Expected: JSON response with `tokenTrend`, `sessionTrend`, `modelBreakdown`, `repoBreakdown`, `insights` keys.

- [ ] **Step 3: Commit**

```bash
git add portal/src/app/api/analytics/route.ts
git commit -m "feat(analytics): add /api/analytics aggregation endpoint"
```

---

### Task 4: Analytics Query Hook

**Files:**
- Create: `portal/src/hooks/useAnalytics.ts`

- [ ] **Step 1: Create the hook**

```typescript
// portal/src/hooks/useAnalytics.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import type { AnalyticsData, TimeRange } from "@/types/analytics";

export function useAnalytics(range: TimeRange) {
  return useQuery<AnalyticsData>({
    queryKey: ["analytics", range],
    queryFn: () =>
      fetch(`/api/analytics?range=${range}`).then((r) => r.json()),
    refetchInterval: 60_000,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/hooks/useAnalytics.ts
git commit -m "feat(analytics): add useAnalytics query hook"
```

---

### Task 5: Chart Components

**Files:**
- Create: `portal/src/components/analytics/TokenTrendChart.tsx`
- Create: `portal/src/components/analytics/SessionTrendChart.tsx`
- Create: `portal/src/components/analytics/ModelBreakdown.tsx`
- Create: `portal/src/components/analytics/RepoBreakdown.tsx`
- Create: `portal/src/components/analytics/InsightsRow.tsx`

- [ ] **Step 1: Token Trend (stacked area chart)**

```tsx
// portal/src/components/analytics/TokenTrendChart.tsx
"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatTokenCount } from "@/lib/utils";
import type { TokenTrendPoint } from "@/types/analytics";

export function TokenTrendChart({ data }: { data: TokenTrendPoint[] }) {
  return (
    <div className="glass-card p-5 sm:p-6">
      <h3 className="text-base font-semibold text-text-primary mb-4">
        Token Usage Over Time
      </h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="fillInput" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="fillOutput" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#6b7280", fontSize: 12 }}
              tickFormatter={(d: string) => {
                const date = new Date(d);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }}
            />
            <YAxis
              tick={{ fill: "#6b7280", fontSize: 12 }}
              tickFormatter={formatTokenCount}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#12121a",
                border: "1px solid #2a2a3e",
                borderRadius: "8px",
                color: "#e5e7eb",
              }}
              formatter={(value: number, name: string) => [
                formatTokenCount(value),
                name === "inputTokens" ? "Input" : "Output",
              ]}
              labelFormatter={(label: string) =>
                new Date(label).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              }
            />
            <Area
              type="monotone"
              dataKey="inputTokens"
              stackId="1"
              stroke="#6366f1"
              fill="url(#fillInput)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="outputTokens"
              stackId="1"
              stroke="#8b5cf6"
              fill="url(#fillOutput)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-6 mt-3 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#6366f1] rounded" />
          Input Tokens
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#8b5cf6] rounded" />
          Output Tokens
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Session Trend (stacked bar chart)**

```tsx
// portal/src/components/analytics/SessionTrendChart.tsx
"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { SessionTrendPoint } from "@/types/analytics";

const COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#818cf8", "#94a3b8"];

export function SessionTrendChart({ data }: { data: SessionTrendPoint[] }) {
  // Find top 5 repos across all dates
  const { topRepos, chartData } = useMemo(() => {
    const repoTotals = new Map<string, number>();
    for (const point of data) {
      for (const [repo, count] of Object.entries(point.repos)) {
        repoTotals.set(repo, (repoTotals.get(repo) ?? 0) + count);
      }
    }
    const sorted = Array.from(repoTotals.entries())
      .sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5).map(([name]) => name);

    const chartData = data.map((point) => {
      const row: Record<string, string | number> = { date: point.date };
      let otherCount = 0;
      for (const [repo, count] of Object.entries(point.repos)) {
        if (top.includes(repo)) {
          row[repo] = count;
        } else {
          otherCount += count;
        }
      }
      if (otherCount > 0) row["Other"] = otherCount;
      return row;
    });

    return { topRepos: sorted.length > 5 ? [...top, "Other"] : top, chartData };
  }, [data]);

  return (
    <div className="glass-card p-5 sm:p-6">
      <h3 className="text-base font-semibold text-text-primary mb-4">
        Sessions Over Time
      </h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#6b7280", fontSize: 12 }}
              tickFormatter={(d: string) => {
                const date = new Date(d);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }}
            />
            <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#12121a",
                border: "1px solid #2a2a3e",
                borderRadius: "8px",
                color: "#e5e7eb",
              }}
              labelFormatter={(label: string) =>
                new Date(label).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              }
            />
            <Legend
              wrapperStyle={{ fontSize: "12px", color: "#6b7280" }}
            />
            {topRepos.map((repo, i) => (
              <Bar
                key={repo}
                dataKey={repo}
                stackId="sessions"
                fill={COLORS[i % COLORS.length]}
                radius={i === topRepos.length - 1 ? [2, 2, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Model Breakdown (donut chart)**

```tsx
// portal/src/components/analytics/ModelBreakdown.tsx
"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatTokenCount } from "@/lib/utils";
import type { ModelBreakdownEntry } from "@/types/analytics";

const COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#818cf8"];

function shortenModel(model: string): string {
  return model
    .replace("claude-", "")
    .replace(/-\d{8}$/, "");
}

export function ModelBreakdown({ data }: { data: ModelBreakdownEntry[] }) {
  const total = data.reduce((sum, d) => sum + d.tokens, 0);

  return (
    <div className="glass-card p-5 sm:p-6">
      <h3 className="text-base font-semibold text-text-primary mb-4">
        Tokens by Model
      </h3>
      <div className="h-56 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="tokens"
              nameKey="model"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#12121a",
                border: "1px solid #2a2a3e",
                borderRadius: "8px",
                color: "#e5e7eb",
              }}
              formatter={(value: number, name: string) => [
                formatTokenCount(value),
                shortenModel(name),
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-lg font-bold font-mono text-text-primary">
              {formatTokenCount(total)}
            </div>
            <div className="text-xs text-text-muted">total</div>
          </div>
        </div>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
        {data.map((entry, i) => (
          <span key={entry.model} className="flex items-center gap-1.5 text-xs text-text-muted">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            {shortenModel(entry.model)}{" "}
            <span className="text-text-secondary font-mono">
              {total > 0 ? Math.round((entry.tokens / total) * 100) : 0}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Repo Breakdown (horizontal bar list)**

```tsx
// portal/src/components/analytics/RepoBreakdown.tsx
"use client";

import { formatTokenCount } from "@/lib/utils";
import type { RepoBreakdownEntry } from "@/types/analytics";

export function RepoBreakdown({ data }: { data: RepoBreakdownEntry[] }) {
  const maxTokens = data.length > 0 ? data[0].tokens : 1;

  return (
    <div className="glass-card p-5 sm:p-6">
      <h3 className="text-base font-semibold text-text-primary mb-4">
        Top Repos by Token Usage
      </h3>
      <div className="space-y-3">
        {data.slice(0, 8).map((entry) => {
          const pct = maxTokens > 0 ? (entry.tokens / maxTokens) * 100 : 0;
          const repoName = entry.repo.split("/").pop() ?? entry.repo;
          const repoOwner = entry.repo.split("/")[0] ?? "";

          return (
            <div key={entry.repo}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-text-primary truncate">
                    {repoName}
                  </span>
                  <span className="text-xs text-text-muted hidden sm:inline">
                    {repoOwner}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-text-muted flex-shrink-0">
                  <span className="font-mono text-text-secondary">
                    {formatTokenCount(entry.tokens)}
                  </span>
                  <span>{entry.sessions} sess</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-bg-surface overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent-indigo to-accent-violet transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        {data.length === 0 && (
          <p className="text-sm text-text-muted text-center py-4">No data</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Insights Row**

```tsx
// portal/src/components/analytics/InsightsRow.tsx
"use client";

import { Clock, Coins, Zap, Database } from "lucide-react";
import { formatDuration, formatTokenCount } from "@/lib/utils";
import type { AnalyticsInsights } from "@/types/analytics";

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

function InsightCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-text-muted" />
        <span className="text-xs text-text-muted">{label}</span>
      </div>
      <div className="text-lg font-bold font-mono text-text-primary">
        {value}
      </div>
    </div>
  );
}

export function InsightsRow({ data }: { data: AnalyticsInsights }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <InsightCard
        label="Avg Duration"
        value={data.avgDuration > 0 ? formatDuration(data.avgDuration) : "--"}
        icon={Clock}
      />
      <InsightCard
        label="Avg Tokens/Session"
        value={
          data.avgTokensPerSession > 0
            ? formatTokenCount(data.avgTokensPerSession)
            : "--"
        }
        icon={Coins}
      />
      <InsightCard
        label="Peak Hour"
        value={formatHour(data.peakHour)}
        icon={Zap}
      />
      <InsightCard
        label="Cache Hit Rate"
        value={`${Math.round(data.cacheHitRate * 100)}%`}
        icon={Database}
      />
    </div>
  );
}
```

- [ ] **Step 6: Commit all chart components**

```bash
git add portal/src/components/analytics/
git commit -m "feat(analytics): add chart components (token trend, session trend, model breakdown, repo breakdown, insights)"
```

---

### Task 6: Analytics Page

**Files:**
- Create: `portal/src/app/analytics/page.tsx`

- [ ] **Step 1: Create the analytics page**

```tsx
// portal/src/app/analytics/page.tsx
"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PageTransition } from "@/components/layout/PageTransition";
import { TimeRangeSelector } from "@/components/shared/TimeRangeSelector";
import { TokenTrendChart } from "@/components/analytics/TokenTrendChart";
import { SessionTrendChart } from "@/components/analytics/SessionTrendChart";
import { ModelBreakdown } from "@/components/analytics/ModelBreakdown";
import { RepoBreakdown } from "@/components/analytics/RepoBreakdown";
import { InsightsRow } from "@/components/analytics/InsightsRow";
import { useAnalytics } from "@/hooks/useAnalytics";
import { CardSkeleton } from "@/components/shared/LoadingSkeleton";
import { BarChart3 } from "lucide-react";
import type { TimeRange } from "@/types/analytics";

export default function AnalyticsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [range, setRange] = useState<TimeRange>(
    (searchParams.get("range") as TimeRange) ?? "7d"
  );
  const { data, isLoading } = useAnalytics(range);

  function handleRangeChange(newRange: TimeRange) {
    setRange(newRange);
    const params = new URLSearchParams(searchParams);
    params.set("range", newRange);
    router.replace(`/analytics?${params.toString()}`);
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-accent-indigo" />
              Analytics
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Token usage, session trends, and breakdown insights
            </p>
          </div>
          <TimeRangeSelector value={range} onChange={handleRangeChange} />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : data ? (
          <>
            {/* Trend Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TokenTrendChart data={data.tokenTrend} />
              <SessionTrendChart data={data.sessionTrend} />
            </div>

            {/* Breakdowns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ModelBreakdown data={data.modelBreakdown} />
              <RepoBreakdown data={data.repoBreakdown} />
            </div>

            {/* Insights */}
            <InsightsRow data={data.insights} />
          </>
        ) : null}
      </div>
    </PageTransition>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/app/analytics/page.tsx
git commit -m "feat(analytics): add analytics page with chart panels and insights"
```

---

### Task 7: Sidebar — Add Analytics Nav Item

**Files:**
- Modify: `portal/src/components/layout/Sidebar.tsx:1-25`

- [ ] **Step 1: Add Analytics to nav items**

In `portal/src/components/layout/Sidebar.tsx`, add `BarChart3` to the lucide-react import and insert the Analytics item between Dashboard and Activity in the `navItems` array.

Change the import line:

```typescript
// OLD
import {
  LayoutDashboard,
  Activity,
  Radio,
  GitFork,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";

// NEW
import {
  LayoutDashboard,
  BarChart3,
  Activity,
  Radio,
  GitFork,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";
```

Change the `navItems` array:

```typescript
// OLD
const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/activity", icon: Activity, label: "Activity" },
  { href: "/live", icon: Radio, label: "Live" },
  { href: "/repos", icon: GitFork, label: "Repos" },
  { href: "/chat", icon: MessageSquare, label: "Chat" },
];

// NEW
const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/activity", icon: Activity, label: "Activity" },
  { href: "/live", icon: Radio, label: "Live" },
  { href: "/repos", icon: GitFork, label: "Repos" },
  { href: "/chat", icon: MessageSquare, label: "Chat" },
];
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/components/layout/Sidebar.tsx
git commit -m "feat(analytics): add Analytics nav item to sidebar"
```

---

### Task 8: Update Dashboard with Time Range Selector

**Files:**
- Modify: `portal/src/hooks/useSessionLogs.ts:49-55`
- Modify: `portal/src/app/api/sessions/route.ts`
- Modify: `portal/src/app/page.tsx`

- [ ] **Step 1: Update useDashboard hook to accept range param**

In `portal/src/hooks/useSessionLogs.ts`, change the `useDashboard` function:

```typescript
// OLD
export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => fetch("/api/sessions").then((r) => r.json()),
    refetchInterval: 30_000,
  });
}

// NEW
export function useDashboard(range?: string) {
  const params = range ? `?range=${range}` : "";
  return useQuery<DashboardData>({
    queryKey: ["dashboard", range],
    queryFn: () => fetch(`/api/sessions${params}`).then((r) => r.json()),
    refetchInterval: 30_000,
  });
}
```

- [ ] **Step 2: Update /api/sessions to accept range param**

In `portal/src/app/api/sessions/route.ts`, change the `GET` function to accept a range query param. Replace the entire function:

```typescript
// portal/src/app/api/sessions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function getStartDate(range: string | null): Date | null {
  if (!range || range === "all") return null;
  const now = new Date();
  const start = new Date(now);
  switch (range) {
    case "today":
      start.setHours(0, 0, 0, 0);
      break;
    case "7d":
      start.setDate(start.getDate() - 7);
      break;
    case "30d":
      start.setDate(start.getDate() - 30);
      break;
    case "90d":
      start.setDate(start.getDate() - 90);
      break;
    default:
      return null;
  }
  return start;
}

export async function GET(req: NextRequest) {
  const range = req.nextUrl.searchParams.get("range");
  const startDate = getStartDate(range);

  // If no range specified, use legacy behavior (today stats + all-time totals)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const where = startDate ? { startedAt: { gte: startDate } } : {};

  const [
    totalSessions,
    totalRepos,
    sessionsToday,
    recentSessions,
    tokenAggregates,
    todayTokens,
    weekCommits,
  ] = await Promise.all([
    prisma.sessionLog.count({ where }),
    prisma.repo.count(),
    prisma.sessionLog.count({
      where: { startedAt: { gte: todayStart } },
    }),
    prisma.sessionLog.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: 10,
      select: {
        id: true,
        sessionId: true,
        repoOwner: true,
        repoName: true,
        branch: true,
        startedAt: true,
        durationSeconds: true,
        summary: true,
        inputTokens: true,
        outputTokens: true,
        model: true,
        entrypoint: true,
        filesChanged: true,
        commits: true,
        toolsUsed: true,
      },
    }),
    prisma.sessionLog.aggregate({
      where,
      _sum: { inputTokens: true, outputTokens: true },
    }),
    prisma.sessionLog.aggregate({
      where: startDate
        ? { startedAt: { gte: startDate } }
        : { startedAt: { gte: todayStart } },
      _sum: { inputTokens: true, outputTokens: true },
    }),
    prisma.sessionLog.findMany({
      where: startDate
        ? { startedAt: { gte: startDate } }
        : { startedAt: { gte: weekStart } },
      select: { commits: true },
    }),
  ]);

  const totalCommits = weekCommits.reduce((sum, s) => {
    const commits = s.commits as unknown[];
    return sum + (Array.isArray(commits) ? commits.length : 0);
  }, 0);

  const totalTokens =
    (tokenAggregates._sum.inputTokens ?? 0) +
    (tokenAggregates._sum.outputTokens ?? 0);

  const tokensToday =
    (todayTokens._sum.inputTokens ?? 0) +
    (todayTokens._sum.outputTokens ?? 0);

  return NextResponse.json({
    stats: {
      totalSessions,
      totalRepos,
      totalTokens,
      totalCommits,
      sessionsToday,
      tokensToday,
    },
    recentSessions,
  });
}
```

- [ ] **Step 3: Add TimeRangeSelector to dashboard page**

In `portal/src/app/page.tsx`, add the time range selector. The key changes:

1. Add imports at the top:
```tsx
import { useState } from "react";
import { TimeRangeSelector } from "@/components/shared/TimeRangeSelector";
import type { TimeRange } from "@/types/analytics";
```

2. Inside `DashboardPage` component, add state and pass range to hook:
```tsx
export default function DashboardPage() {
  const [range, setRange] = useState<TimeRange>("today");
  const { data, isLoading } = useDashboard(range);
```

3. Add the selector in the header section, between the `<div>` with the title and the stats grid:
```tsx
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary">
              Dashboard
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Overview of your Claude Code activity
            </p>
          </div>
          <TimeRangeSelector value={range} onChange={setRange} />
        </div>
```

- [ ] **Step 4: Verify dashboard and analytics pages work**

Run: `cd portal && npm run dev`

1. Open `http://localhost:3000` — verify time range selector appears and stats change when switching ranges
2. Open `http://localhost:3000/analytics` — verify all 4 chart panels render with data
3. Click between time ranges on analytics — verify charts update

- [ ] **Step 5: Commit**

```bash
git add portal/src/hooks/useSessionLogs.ts portal/src/app/api/sessions/route.ts portal/src/app/page.tsx
git commit -m "feat(analytics): add time range selector to dashboard and analytics pages"
```

---

### Task 9: TypeScript Check & Final Verification

- [ ] **Step 1: Run TypeScript check**

Run: `cd portal && npx tsc --noEmit`

Expected: No errors. If there are errors, fix them.

- [ ] **Step 2: Run dev server and verify all pages**

Run: `cd portal && npm run dev`

Verify each page loads without errors:
- `http://localhost:3000` — Dashboard with time range
- `http://localhost:3000/analytics` — 4 chart panels + insights
- `http://localhost:3000/analytics?range=30d` — URL param works
- `http://localhost:3000/activity` — Still works
- `http://localhost:3000/repos` — Still works

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(analytics): address TypeScript and runtime issues"
```
