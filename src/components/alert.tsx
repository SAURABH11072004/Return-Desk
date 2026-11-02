import { button } from "@/components/button";

/** A visible, announced error. Never swallow a server refusal: show its message here. */
export function ErrorAlert({ title, message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {title && <p className="font-semibold">{title}</p>}
        <p>{message}</p>
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className={`${button.secondary} shrink-0`}>
          Try again
        </button>
      )}
    </div>
  );
}
