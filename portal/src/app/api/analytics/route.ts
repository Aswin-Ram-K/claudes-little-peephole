import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
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
  const whereClause = startDate
    ? Prisma.sql`WHERE "startedAt" >= ${startDate}`
    : Prisma.empty;

  // Token trend — group by date
  const tokenTrendRaw = await prisma.$queryRaw<
    { date: string; input_tokens: bigint; output_tokens: bigint }[]
  >(Prisma.sql`
    SELECT
      TO_CHAR("startedAt", 'YYYY-MM-DD') as date,
      COALESCE(SUM("inputTokens"), 0) as input_tokens,
      COALESCE(SUM("outputTokens"), 0) as output_tokens
    FROM session_logs
    ${whereClause}
    GROUP BY TO_CHAR("startedAt", 'YYYY-MM-DD')
    ORDER BY date ASC
  `);

  const tokenTrend = tokenTrendRaw.map((r) => ({
    date: r.date,
    inputTokens: Number(r.input_tokens),
    outputTokens: Number(r.output_tokens),
  }));

  // Session trend — group by date and repo
  const sessionTrendRaw = await prisma.$queryRaw<
    { date: string; repo_name: string; count: bigint }[]
  >(Prisma.sql`
    SELECT
      TO_CHAR("startedAt", 'YYYY-MM-DD') as date,
      "repoName" as repo_name,
      COUNT(*) as count
    FROM session_logs
    ${whereClause}
    GROUP BY TO_CHAR("startedAt", 'YYYY-MM-DD'), "repoName"
    ORDER BY date ASC
  `);

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
  const [aggregates, peakHourRaw] = await Promise.all([
    prisma.sessionLog.aggregate({
      where,
      _avg: { durationSeconds: true, inputTokens: true, outputTokens: true },
    }),
    prisma.$queryRaw<{ hour: number; count: bigint }[]>(Prisma.sql`
      SELECT EXTRACT(HOUR FROM "startedAt")::int as hour, COUNT(*) as count
      FROM session_logs
      ${whereClause}
      GROUP BY EXTRACT(HOUR FROM "startedAt")
      ORDER BY count DESC
      LIMIT 1
    `),
  ]);

  const avgTokensPerSession =
    (aggregates._avg.inputTokens ?? 0) + (aggregates._avg.outputTokens ?? 0);

  // Cache hit rate from rawLog JSON
  const cacheData = await prisma.$queryRaw<
    { cache_read: bigint; total_input: bigint }[]
  >(Prisma.sql`
    SELECT
      COALESCE(SUM(CASE
        WHEN "rawLog"->>'cacheReadTokens' IS NOT NULL
        THEN ("rawLog"->>'cacheReadTokens')::bigint
        ELSE 0
      END), 0) as cache_read,
      COALESCE(SUM("inputTokens"), 0) as total_input
    FROM session_logs
    ${whereClause}
  `);

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
