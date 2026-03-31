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
