import { LoaderCircle } from "lucide-react";
import { button } from "@/components/button";

/** Cancel + confirm row used at the bottom of every dialog. */
export function DialogButtons({
  pending,
  onCancel,
  onConfirm,
  confirmLabel,
  danger = false,
  submit = false,
}: {
  pending: boolean;
  onCancel: () => void;
  onConfirm?: () => void;
  confirmLabel: string;
  danger?: boolean;
  submit?: boolean;
}) {
  return (
    <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button type="button" className={button.secondary} onClick={onCancel} disabled={pending}>
        Cancel
      </button>
      <button
        type={submit ? "submit" : "button"}
        className={danger ? button.dangerSolid : button.primary}
        onClick={onConfirm}
        disabled={pending}
      >
        {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
        {confirmLabel}
      </button>
    </div>
  );
}
