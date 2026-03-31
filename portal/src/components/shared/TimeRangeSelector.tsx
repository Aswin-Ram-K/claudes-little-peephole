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
