"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ShieldCheck, X } from "lucide-react";
import { ConfigDiffPreview } from "./ConfigDiffPreview";
import type { ConfigChangeProposal } from "@/types/chat";

interface ApprovalDialogProps {
  proposal: ConfigChangeProposal;
  onApprove: () => void;
  onDeny: () => void;
}

export function ApprovalDialog({ proposal, onApprove, onDeny }: ApprovalDialogProps) {
  return (
    <Dialog.Root open={true}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-2xl max-h-[85vh] overflow-y-auto bg-bg-card border border-border-subtle rounded-2xl shadow-2xl animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-accent-indigo" />
              <Dialog.Title className="text-base font-semibold text-text-primary">
                Approve Configuration Change
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                onClick={onDeny}
                className="p-1.5 rounded-lg hover:bg-bg-surface transition-colors"
              >
                <X className="w-4 h-4 text-text-muted" />
              </button>
            </Dialog.Close>
          </div>

          {/* Diff Preview */}
          <div className="p-5">
            <ConfigDiffPreview
              filePath={proposal.filePath}
              description={proposal.description}
              before={proposal.before}
              after={proposal.after}
              status="pending"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 p-5 border-t border-border-subtle">
            <button
              onClick={onDeny}
              className="px-4 py-2 text-sm font-medium text-text-secondary bg-bg-surface border border-border-subtle rounded-lg hover:bg-bg-hover transition-colors"
            >
              Deny
            </button>
            <button
              onClick={onApprove}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-accent-indigo to-accent-violet rounded-lg hover:opacity-90 transition-opacity"
            >
              Approve Change
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
