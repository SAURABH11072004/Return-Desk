"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ErrorAlert } from "@/components/alert";
import { DialogButtons } from "@/components/dialog-buttons";
import { Modal } from "@/components/modal";

/** Yes/no confirmation. Destructive confirmations use the danger tone and a red button. */
export function ConfirmDialog({
  open,
  title,
  description,
  icon,
  confirmLabel,
  danger = false,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  icon?: LucideIcon;
  confirmLabel: string;
  danger?: boolean;
  pending: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} title={title} description={description} icon={icon} tone={danger ? "danger" : "default"} onClose={onCancel}>
      <div className="flex flex-col gap-4">
        {error && <ErrorAlert message={error} />}
        <DialogButtons pending={pending} onCancel={onCancel} onConfirm={onConfirm} confirmLabel={confirmLabel} danger={danger} />
      </div>
    </Modal>
  );
}
