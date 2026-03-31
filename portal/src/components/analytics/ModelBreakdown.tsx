"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatTokenCount } from "@/lib/utils";
import type { ModelBreakdownEntry } from "@/types/analytics";

const COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#818cf8"];

function shortenModel(model: string): string {
  return model.replace("claude-", "").replace(/-\d{8}$/, "");
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
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-lg font-bold font-mono text-text-primary">
              {formatTokenCount(total)}
            </div>
            <div className="text-xs text-text-muted">total</div>
          </div>
        </div>
      </div>
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
