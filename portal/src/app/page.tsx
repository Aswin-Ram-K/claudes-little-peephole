"use client";

import { useState } from "react";
import { TimeRangeSelector } from "@/components/shared/TimeRangeSelector";
import type { TimeRange } from "@/types/analytics";
import { PageTransition } from "@/components/layout/PageTransition";
import { DashboardSkeleton } from "@/components/shared/LoadingSkeleton";
import { Badge } from "@/components/shared/Badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { useDashboard, type SessionRow } from "@/hooks/useSessionLogs";
import { formatDuration, formatTokenCount, formatRelativeTime, truncate } from "@/lib/utils";
import {
  Activity,
  GitCommit,
  Cpu,
  Coins,
  Radio,
  Clock,
  GitFork,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";

function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  accentColor,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  trend?: string;
  accentColor?: string;
}) {
  return (
    <div className="glass-card glow-hover p-5 sm:p-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-text-secondary">{label}</span>
        <div
          className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center",
            accentColor || "bg-accent-indigo/10"
          )}
        >
          <Icon className="w-4 h-4 text-current" />
        </div>
      </div>
      <div className="text-2xl sm:text-3xl font-bold text-text-primary font-mono">
        {value}
      </div>
      {trend && <p className="text-xs text-text-muted mt-1">{trend}</p>}
    </div>
  );
}

function ActivityItem({ session }: { session: SessionRow }) {
  const repo = `${session.repoOwner}/${session.repoName}`;
  const time = formatRelativeTime(new Date(session.startedAt));

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border-subtle last:border-0 group">
      <div className="w-2 h-2 rounded-full bg-accent-indigo mt-2 flex-shrink-0 group-hover:shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-shadow" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-text-primary">
            {session.repoName}
          </span>
          {session.branch && (
            <Badge variant="accent">{truncate(session.branch, 25)}</Badge>
          )}
        </div>
        <p className="text-sm text-text-secondary mt-0.5 truncate">
          {session.summary ?? "Session"}
        </p>
      </div>
      <span className="text-xs text-text-muted flex-shrink-0">{time}</span>
    </div>
  );
}

export default function DashboardPage() {
  const [range, setRange] = useState<TimeRange>("today");
  const { data, isLoading } = useDashboard(range);

  if (isLoading) {
    return (
      <PageTransition>
        <DashboardSkeleton />
      </PageTransition>
    );
  }

  if (!data || data.stats.totalSessions === 0) {
    return (
      <PageTransition>
        <EmptyState
          icon={Inbox}
          title="No sessions yet"
          description="Click Sync in the top bar to pull session data from your repos, or start a Claude Code session to generate logs."
        />
      </PageTransition>
    );
  }

  const { stats, recentSessions } = data;

  return (
    <PageTransition>
      <div className="space-y-6">
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

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Sessions Today"
            value={String(stats.sessionsToday)}
            icon={Activity}
            trend={`${stats.totalSessions} total`}
            accentColor="bg-accent-indigo/10"
          />
          <StatCard
            label="Total Repos"
            value={String(stats.totalRepos)}
            icon={GitFork}
            accentColor="bg-accent-violet/10"
          />
          <StatCard
            label="Tokens Used"
            value={formatTokenCount(stats.tokensToday)}
            icon={Coins}
            trend="Today"
            accentColor="bg-status-warning/10"
          />
          <StatCard
            label="Commits"
            value={String(stats.totalCommits)}
            icon={GitCommit}
            trend="This week"
            accentColor="bg-status-success/10"
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity Timeline */}
          <div className="lg:col-span-2 glass-card p-5 sm:p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent-indigo" />
              Recent Activity
            </h2>
            <div className="space-y-0">
              {recentSessions.map((session) => (
                <ActivityItem key={session.id} session={session} />
              ))}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <div className="glass-card p-5 sm:p-6">
              <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-accent-violet" />
                Latest Session
              </h2>
              {recentSessions[0] && (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Repo</span>
                    <span className="text-text-primary font-mono text-xs">
                      {recentSessions[0].repoName}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Model</span>
                    <span className="text-text-primary font-mono text-xs">
                      {recentSessions[0].model ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Input Tokens</span>
                    <span className="text-text-primary font-mono">
                      {formatTokenCount(recentSessions[0].inputTokens ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Output Tokens</span>
                    <span className="text-text-primary font-mono">
                      {formatTokenCount(recentSessions[0].outputTokens ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Duration</span>
                    <span className="text-text-primary font-mono">
                      {recentSessions[0].durationSeconds
                        ? formatDuration(recentSessions[0].durationSeconds)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Files Changed</span>
                    <span className="text-text-primary font-mono">
                      {(recentSessions[0].filesChanged as string[])?.length ?? 0}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
