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
