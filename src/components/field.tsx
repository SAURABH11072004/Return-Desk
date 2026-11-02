import type { ReactNode } from "react";

export const inputClass =
  "block h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink " +
  "placeholder:text-faint transition-[border-color,box-shadow] duration-150 " +
  "hover:border-[#c4c2bc] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 " +
  "disabled:bg-surface-2 disabled:text-muted " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15";

export const textareaClass = inputClass.replace("h-9", "min-h-24 py-2");

/** Label + control + inline error. The control should set aria-invalid and aria-describedby itself. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs text-danger-text">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

/** Props that connect an input to its Field error message. */
export const describedBy = (id: string, error?: string) =>
  ({ id, "aria-invalid": Boolean(error), "aria-describedby": error ? `${id}-error` : undefined }) as const;
