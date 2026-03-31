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
