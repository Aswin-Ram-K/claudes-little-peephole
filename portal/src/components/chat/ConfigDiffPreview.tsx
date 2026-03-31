"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/shared/Badge";
import { FileText, Check, X, Clock } from "lucide-react";

interface ConfigDiffPreviewProps {
  filePath: string;
  description: string;
  before: string;
  after: string;
  status: "pending" | "approved" | "denied";
  className?: string;
}

export function ConfigDiffPreview({
  filePath,
  description,
  before,
  after,
  status,
  className,
}: ConfigDiffPreviewProps) {
  const statusConfig = {
    pending: { variant: "warning" as const, icon: Clock, label: "Pending Approval" },
    approved: { variant: "success" as const, icon: Check, label: "Applied" },
    denied: { variant: "error" as const, icon: X, label: "Denied" },
  };

  const { variant, icon: StatusIcon, label } = statusConfig[status];

  const fileName = filePath.split("/").pop() || filePath;

  return (
    <div className={cn("rounded-xl border border-border-subtle overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-bg-surface/50 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-accent-indigo" />
          <span className="text-xs font-mono text-text-secondary">{fileName}</span>
        </div>
        <Badge variant={variant} className="flex items-center gap-1">
          <StatusIcon className="w-3 h-3" />
          {label}
        </Badge>
      </div>

      {/* Description */}
      {description && (
        <div className="px-4 py-2 text-xs text-text-secondary border-b border-border-subtle bg-bg-card/50">
          {description}
        </div>
      )}

      {/* Diff view */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border-subtle">
        {/* Before */}
        <div className="min-w-0">
          <div className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/5 border-b border-border-subtle">
            Before
          </div>
          <pre className="p-3 text-xs font-mono text-text-secondary overflow-x-auto whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
            {before || <span className="italic text-text-muted">(empty)</span>}
          </pre>
        </div>

        {/* After */}
        <div className="min-w-0">
          <div className="px-3 py-1.5 text-xs font-medium text-green-400 bg-green-500/5 border-b border-border-subtle">
            After
          </div>
          <pre className="p-3 text-xs font-mono text-text-secondary overflow-x-auto whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
            {after || <span className="italic text-text-muted">(empty)</span>}
          </pre>
        </div>
      </div>

      {/* Full path */}
      <div className="px-4 py-1.5 text-[10px] text-text-muted bg-bg-surface/30 border-t border-border-subtle font-mono truncate">
        {filePath}
      </div>
    </div>
  );
}
