import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** A purposeful empty state: icon, what it means, and what to do next. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-11 place-items-center rounded-lg border border-line bg-surface-2 text-muted">
        <Icon aria-hidden className="size-5" />
      </span>
      <h3 className="mt-4 text-[15px] font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
