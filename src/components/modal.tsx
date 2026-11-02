"use client";

import { X, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Native <dialog>: focus trapping, Escape to close and the backdrop come from the browser.
 * The entrance animation is in globals.css (dialog[open]).
 */
export function Modal({
  open,
  title,
  description,
  icon: Icon,
  tone = "default",
  size = "md",
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "danger";
  size?: "md" | "lg";
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className={`m-auto w-[calc(100%-1.5rem)] rounded-xl border border-line bg-surface p-0 text-ink shadow-pop ${
        size === "lg" ? "max-w-2xl" : "max-w-md"
      }`}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start gap-3.5 px-5 pt-5 sm:px-6 sm:pt-6">
            {Icon && (
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-lg ${
                  tone === "danger" ? "bg-danger-soft text-danger-text" : "bg-accent-soft text-accent-text"
                }`}
              >
                <Icon aria-hidden className="size-[18px]" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-base font-semibold">
                {title}
              </h2>
              {description && <div className="mt-1 text-sm text-muted">{description}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 -mt-1 grid size-8 place-items-center rounded-md text-faint transition-colors hover:bg-surface-3 hover:text-ink"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 pb-5 pt-4 sm:px-6 sm:pb-6">{children}</div>
        </div>
      )}
    </dialog>
  );
}
