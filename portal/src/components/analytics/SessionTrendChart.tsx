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
            <Legend wrapperStyle={{ fontSize: "12px", color: "#6b7280" }} />
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
