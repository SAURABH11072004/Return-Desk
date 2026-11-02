import { CircleAlert } from "lucide-react";
import { button } from "@/components/button";

/** A visible, announced error. Never swallow a server refusal: show its message here. */
export function ErrorAlert({ title, message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex animate-fade-in flex-col gap-3 rounded-xl border border-danger-line bg-danger-soft p-3.5 text-sm text-danger-text sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex gap-2.5">
        <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        <div>
          {title && <p className="font-semibold">{title}</p>}
          <p>{message}</p>
        </div>
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className={`${button.smallSecondary} shrink-0`}>
          Try again
        </button>
      )}
    </div>
  );
}
