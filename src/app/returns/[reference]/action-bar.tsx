"use client";

import { BadgeCheck, CircleX, PackageCheck, PencilLine, ScanSearch, Trash2, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorAlert } from "@/components/alert";
import { button } from "@/components/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DialogButtons } from "@/components/dialog-buttons";
import { describedBy, Field, inputClass } from "@/components/field";
import { Modal } from "@/components/modal";
import { RESOLUTION_META } from "@/components/status-meta";
import { useToast } from "@/components/toast";
import { apiFetch, ApiRequestError, errorMessage, fieldErrors } from "@/lib/api-client";
import type { ReturnDetail } from "@/lib/api-types";
import { RESOLUTION_LABELS, RESOLUTIONS, STATUS_LABELS, type Resolution, type ReturnStatus } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import { toFieldIssues, transitionSchema } from "@/lib/validation";
import { EditDetailsDialog } from "./edit-details-dialog";

type Target = Exclude<ReturnStatus, "open">;
type Dialog = { kind: "approve" } | { kind: "confirm"; to: "rejected" | "completed" } | { kind: "remove" } | { kind: "edit" };

const TRANSITION_BUTTONS: Record<Target, { label: string; icon: LucideIcon; style: string; done: string; failed: string }> = {
  in_review: { label: "Start review", icon: ScanSearch, style: button.primary, done: "Moved to review", failed: "Unable to start the review" },
  approved: { label: "Approve", icon: BadgeCheck, style: button.primary, done: "Return approved", failed: "Unable to approve this return" },
  rejected: { label: "Reject", icon: CircleX, style: button.danger, done: "Return rejected", failed: "Unable to reject this return" },
  completed: { label: "Mark completed", icon: PackageCheck, style: button.primary, done: "Return completed", failed: "Unable to complete this return" },
};

const CONFIRM_COPY = {
  rejected: {
    title: "Reject this return?",
    body: "Rejected is final: the request cannot move again and its details lock. Notes can still be added.",
    action: "Reject return",
  },
  completed: {
    title: "Mark as completed?",
    body: "Completed is final: the return is closed out and cannot move again.",
    action: "Mark completed",
  },
};

/**
 * Renders only the actions the API reports as legal right now (detail.allowedActions); the
 * server still enforces every rule. Success and failure are both reported with a toast, and a
 * refusal (409/404) also reloads the request so the offered actions match its real state.
 */
export function ActionBar({
  detail,
  onUpdated,
  onStale,
}: {
  detail: ReturnDetail;
  onUpdated: (detail: ReturnDetail) => void;
  onStale: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { transitions, canEdit, canRemove } = detail.allowedActions;
  const path = `/api/returns/${encodeURIComponent(detail.reference)}`;

  /** Report a refusal. Inside a dialog the error shows inline (a toast would sit behind the backdrop). */
  function refused(err: unknown, title: string) {
    const message = errorMessage(err);
    setError(message);
    if (!dialog) toast.error(title, message);
    if (err instanceof ApiRequestError && (err.status === 409 || err.status === 404)) onStale();
  }

  async function transition(to: Target) {
    setPending(true);
    setError(null);
    try {
      const { data } = await apiFetch<{ data: ReturnDetail }>(`${path}/transitions`, { method: "POST", json: { to } });
      onUpdated(data);
      setDialog(null);
      toast.success(TRANSITION_BUTTONS[to].done, `${detail.reference} is now ${STATUS_LABELS[data.status]}.`);
    } catch (err) {
      refused(err, TRANSITION_BUTTONS[to].failed);
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setPending(true);
    setError(null);
    try {
      await apiFetch<void>(path, { method: "DELETE" });
      toast.success("Return removed", `${detail.reference} was taken off the desk. The record is kept.`);
      router.push("/returns");
    } catch (err) {
      refused(err, "Unable to remove this return");
      setPending(false);
    }
  }

  const onTransitionClick = (to: Target) => {
    setError(null);
    if (to === "approved") setDialog({ kind: "approve" });
    else if (to === "rejected" || to === "completed") setDialog({ kind: "confirm", to });
    else void transition(to);
  };

  const closeDialog = () => {
    setDialog(null);
    setError(null);
  };

  if (transitions.length === 0 && !canEdit && !canRemove) {
    return (
      <p className="rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-muted">
        Closed. No further status changes are possible.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 lg:items-end">
      <div className="flex flex-wrap gap-2 lg:justify-end">
        {canRemove && (
          <button type="button" className={button.danger} disabled={pending} onClick={() => setDialog({ kind: "remove" })}>
            <Trash2 aria-hidden className="size-4" />
            Remove
          </button>
        )}
        {canEdit && (
          <button type="button" className={button.secondary} disabled={pending} onClick={() => setDialog({ kind: "edit" })}>
            <PencilLine aria-hidden className="size-4" />
            Edit details
          </button>
        )}
        {[...transitions].reverse().map((to) => {
          const config = TRANSITION_BUTTONS[to as Target];
          const Icon = config.icon;
          return (
            <button key={to} type="button" className={config.style} disabled={pending} onClick={() => onTransitionClick(to as Target)}>
              <Icon aria-hidden className="size-4" />
              {config.label}
            </button>
          );
        })}
      </div>

      {error && !dialog && <ErrorAlert title="The server refused this action" message={error} />}

      <ConfirmDialog
        open={dialog?.kind === "confirm"}
        title={dialog?.kind === "confirm" ? CONFIRM_COPY[dialog.to].title : ""}
        description={dialog?.kind === "confirm" ? CONFIRM_COPY[dialog.to].body : ""}
        icon={dialog?.kind === "confirm" ? TRANSITION_BUTTONS[dialog.to].icon : undefined}
        confirmLabel={dialog?.kind === "confirm" ? CONFIRM_COPY[dialog.to].action : ""}
        danger={dialog?.kind === "confirm" && dialog.to === "rejected"}
        pending={pending}
        error={error}
        onConfirm={() => dialog?.kind === "confirm" && void transition(dialog.to)}
        onCancel={closeDialog}
      />

      <ConfirmDialog
        open={dialog?.kind === "remove"}
        title="Remove this return?"
        description={
          <>
            <span className="font-mono font-medium text-ink">{detail.reference}</span> will be removed from the active workspace but
            retained in the database. It can no longer be opened.
          </>
        }
        icon={Trash2}
        confirmLabel="Remove return"
        danger
        pending={pending}
        error={error}
        onConfirm={() => void remove()}
        onCancel={closeDialog}
      />

      <Modal
        open={dialog?.kind === "approve"}
        title={`Approve ${detail.reference}`}
        description="Choose how this return is resolved. A refund needs an amount."
        icon={BadgeCheck}
        onClose={closeDialog}
      >
        {dialog?.kind === "approve" && (
          <ApproveForm
            detail={detail}
            path={path}
            onDone={(updated) => {
              onUpdated(updated);
              closeDialog();
              toast.success(
                "Return approved",
                `Resolution: ${RESOLUTION_LABELS[updated.resolution!]}${updated.refundAmount ? ` · ${formatMoney(updated.refundAmount)}` : ""}`,
              );
            }}
            onFailed={(err) => {
              if (err instanceof ApiRequestError && (err.status === 409 || err.status === 404)) onStale();
            }}
            onCancel={closeDialog}
          />
        )}
      </Modal>

      <Modal
        open={dialog?.kind === "edit"}
        title={`Edit ${detail.reference}`}
        description="Correct the customer or item details. Allowed until the request is decided."
        icon={PencilLine}
        size="lg"
        onClose={closeDialog}
      >
        {dialog?.kind === "edit" && (
          <EditDetailsDialog
            detail={detail}
            path={path}
            onDone={(updated) => {
              onUpdated(updated);
              closeDialog();
              toast.success("Details updated", `${detail.reference} has been corrected.`);
            }}
            onFailed={(err) => {
              if (err instanceof ApiRequestError && (err.status === 409 || err.status === 404)) onStale();
            }}
            onCancel={closeDialog}
          />
        )}
      </Modal>
    </div>
  );
}

function ApproveForm({
  detail,
  path,
  onDone,
  onFailed,
  onCancel,
}: {
  detail: ReturnDetail;
  path: string;
  onDone: (detail: ReturnDetail) => void;
  onFailed: (error: unknown) => void;
  onCancel: () => void;
}) {
  const [resolution, setResolution] = useState<Resolution | "">("");
  const [refundAmount, setRefundAmount] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const maxRefund = Number(detail.item.unitPrice) * detail.quantity;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const payload = {
      to: "approved" as const,
      resolution: resolution || undefined,
      refundAmount: resolution === "refund" ? (refundAmount.trim() === "" ? undefined : Number(refundAmount)) : undefined,
    };
    const check = transitionSchema.safeParse(payload);
    if (!check.success) {
      setErrors(fieldErrors(toFieldIssues(check.error)));
      return;
    }
    setPending(true);
    setErrors({});
    setFormError(null);
    try {
      const { data } = await apiFetch<{ data: ReturnDetail }>(`${path}/transitions`, { method: "POST", json: check.data });
      onDone(data);
    } catch (err) {
      setFormError(errorMessage(err));
      if (err instanceof ApiRequestError) setErrors(fieldErrors(err.issues));
      onFailed(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <fieldset aria-describedby={errors.resolution ? "resolution-error" : undefined}>
        <legend className="mb-2 text-[13px] font-medium text-ink-2">Resolution</legend>
        <div className="grid gap-2">
          {RESOLUTIONS.map((option) => {
            const Icon = RESOLUTION_META[option].icon;
            return (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface p-3 transition-all hover:border-line-strong has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:shadow-card has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-accent/15"
              >
                <input
                  type="radio"
                  name="resolution"
                  value={option}
                  checked={resolution === option}
                  onChange={() => setResolution(option)}
                  className="sr-only"
                />
                <span className="grid size-9 place-items-center rounded-lg border border-line bg-surface-2 text-ink-2">
                  <Icon aria-hidden className="size-4" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-ink">{RESOLUTION_LABELS[option]}</span>
                  <span className="block text-xs text-muted">{RESOLUTION_META[option].description}</span>
                </span>
                <span
                  aria-hidden
                  className={`size-4 rounded-full border-2 transition-colors ${resolution === option ? "border-accent bg-accent shadow-[inset_0_0_0_3px_var(--color-surface)]" : "border-line-strong"}`}
                />
              </label>
            );
          })}
        </div>
        {errors.resolution && (
          <p id="resolution-error" className="mt-1.5 text-xs text-danger-text">
            {errors.resolution}
          </p>
        )}
      </fieldset>

      {resolution === "refund" && (
        <div className="animate-fade-up">
          <Field
            label="Refund amount (₹)"
            htmlFor="refund-amount"
            error={errors.refundAmount}
            hint={`Up to ${formatMoney(maxRefund)} for ${detail.quantity} unit${detail.quantity === 1 ? "" : "s"}`}
          >
            <input
              {...describedBy("refund-amount", errors.refundAmount)}
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              max={maxRefund}
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              placeholder="0.00"
              className={inputClass}
            />
          </Field>
        </div>
      )}

      {formError && <ErrorAlert message={formError} />}
      <DialogButtons pending={pending} onCancel={onCancel} confirmLabel="Approve return" submit />
    </form>
  );
}
