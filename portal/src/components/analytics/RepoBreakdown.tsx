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
