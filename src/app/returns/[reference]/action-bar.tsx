"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorAlert } from "@/components/alert";
import { button } from "@/components/button";
import { describedBy, Field, inputClass } from "@/components/field";
import { DialogButtons } from "@/components/dialog-buttons";
import { Modal } from "@/components/modal";
import { apiFetch, ApiRequestError, errorMessage, fieldErrors } from "@/lib/api-client";
import type { ReturnDetail } from "@/lib/api-types";
import { RESOLUTION_LABELS, RESOLUTIONS, type Resolution, type ReturnStatus } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import { toFieldIssues, transitionSchema } from "@/lib/validation";
import { EditDetailsDialog } from "./edit-details-dialog";

type Dialog = { kind: "approve" } | { kind: "confirm"; to: "rejected" | "completed" } | { kind: "remove" } | { kind: "edit" };

const TRANSITION_BUTTONS: Record<Exclude<ReturnStatus, "open">, { label: string; style: string }> = {
  in_review: { label: "Start review", style: button.primary },
  approved: { label: "Approve…", style: button.primary },
  rejected: { label: "Reject…", style: button.danger },
  completed: { label: "Mark completed…", style: button.primary },
};

const CONFIRM_COPY = {
  rejected: {
    title: "Reject this request?",
    body: "Rejected is final: the request cannot move again. Its details lock, but notes can still be added.",
    action: "Reject request",
  },
  completed: {
    title: "Mark as completed?",
    body: "Completed is final: the request is closed out and cannot move again.",
    action: "Mark completed",
  },
};

/**
 * Renders only the actions the API says are legal right now (detail.allowedActions). The server
 * still enforces every rule; if it refuses, the reason is shown and the request is reloaded.
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
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { transitions, canEdit, canRemove } = detail.allowedActions;
  const path = `/api/returns/${encodeURIComponent(detail.reference)}`;

  /** Run a mutation; on refusal show the server's reason and refresh if our copy is out of date. */
  async function run(action: () => Promise<void>): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (err) {
      setError(errorMessage(err));
      if (err instanceof ApiRequestError && (err.status === 409 || err.status === 404)) onStale();
      return false;
    } finally {
      setPending(false);
    }
  }

  const transition = (to: ReturnStatus) =>
    run(async () => {
      const { data } = await apiFetch<{ data: ReturnDetail }>(`${path}/transitions`, { method: "POST", json: { to } });
      onUpdated(data);
      setDialog(null);
    });

  const remove = () =>
    run(async () => {
      await apiFetch<void>(path, { method: "DELETE" });
      router.push("/returns");
    });

  const onTransitionClick = (to: ReturnStatus) => {
    setError(null);
    if (to === "approved") setDialog({ kind: "approve" });
    else if (to === "rejected" || to === "completed") setDialog({ kind: "confirm", to });
    else void transition(to);
  };

  const closeDialog = () => {
    setDialog(null);
    setError(null);
  };

  const hasActions = transitions.length > 0 || canEdit || canRemove;

  return (
    <section aria-label="Actions" className="flex flex-col gap-3">
      {hasActions ? (
        <div className="flex flex-wrap gap-2">
          {transitions.map((to) => {
            const config = TRANSITION_BUTTONS[to as Exclude<ReturnStatus, "open">];
            return (
              <button key={to} type="button" className={config.style} disabled={pending} onClick={() => onTransitionClick(to)}>
                {config.label}
              </button>
            );
          })}
          {canEdit && (
            <button type="button" className={button.secondary} disabled={pending} onClick={() => setDialog({ kind: "edit" })}>
              Edit details
            </button>
          )}
          {canRemove && (
            <button type="button" className={`${button.danger} sm:ml-auto`} disabled={pending} onClick={() => setDialog({ kind: "remove" })}>
              Remove from desk
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-600">This request is closed. No further status changes are possible; notes can still be added.</p>
      )}

      {error && !dialog && <ErrorAlert title="The server refused this action" message={error} />}

      <Modal open={dialog?.kind === "confirm"} title={dialog?.kind === "confirm" ? CONFIRM_COPY[dialog.to].title : ""} onClose={closeDialog}>
        {dialog?.kind === "confirm" && (
          <>
            <p className="text-sm text-slate-600">{CONFIRM_COPY[dialog.to].body}</p>
            {error && <ErrorAlert message={error} />}
            <DialogButtons
              pending={pending}
              onCancel={closeDialog}
              onConfirm={() => void transition(dialog.to)}
              confirmLabel={CONFIRM_COPY[dialog.to].action}
              danger={dialog.to === "rejected"}
            />
          </>
        )}
      </Modal>

      <Modal open={dialog?.kind === "remove"} title={`Remove ${detail.reference} from the desk?`} onClose={closeDialog}>
        <p className="text-sm text-slate-600">
          It will disappear from the list and can no longer be opened. The record is kept in the database, not destroyed.
        </p>
        {error && <ErrorAlert message={error} />}
        <DialogButtons pending={pending} onCancel={closeDialog} onConfirm={() => void remove()} confirmLabel="Remove" danger />
      </Modal>

      <Modal open={dialog?.kind === "approve"} title={`Approve ${detail.reference}`} onClose={closeDialog}>
        {dialog?.kind === "approve" && <ApproveForm detail={detail} path={path} onDone={(d) => { onUpdated(d); closeDialog(); }} onCancel={closeDialog} onStale={onStale} />}
      </Modal>

      <Modal open={dialog?.kind === "edit"} title={`Edit ${detail.reference}`} onClose={closeDialog}>
        {dialog?.kind === "edit" && <EditDetailsDialog detail={detail} path={path} onDone={(d) => { onUpdated(d); closeDialog(); }} onCancel={closeDialog} onStale={onStale} />}
      </Modal>
    </section>
  );
}

function ApproveForm({
  detail,
  path,
  onDone,
  onCancel,
  onStale,
}: {
  detail: ReturnDetail;
  path: string;
  onDone: (detail: ReturnDetail) => void;
  onCancel: () => void;
  onStale: () => void;
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
      if (err instanceof ApiRequestError) {
        setErrors(fieldErrors(err.issues));
        if (err.status === 409 || err.status === 404) onStale();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <fieldset aria-describedby={errors.resolution ? "resolution-error" : undefined}>
        <legend className="mb-2 text-sm font-medium text-slate-700">Resolution</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {RESOLUTIONS.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 p-2.5 text-sm has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50"
            >
              <input type="radio" name="resolution" value={option} checked={resolution === option} onChange={() => setResolution(option)} />
              {RESOLUTION_LABELS[option]}
            </label>
          ))}
        </div>
        {errors.resolution && (
          <p id="resolution-error" className="mt-1 text-xs text-rose-700">
            {errors.resolution}
          </p>
        )}
      </fieldset>

      {resolution === "refund" && (
        <Field
          label="Refund amount (₹)"
          htmlFor="refund-amount"
          error={errors.refundAmount}
          hint={`Up to ${formatMoney(maxRefund)} for ${detail.quantity} unit(s)`}
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
            className={inputClass}
          />
        </Field>
      )}

      {formError && <ErrorAlert message={formError} />}
      <DialogButtons pending={pending} onCancel={onCancel} confirmLabel="Approve" submit />
    </form>
  );
}
