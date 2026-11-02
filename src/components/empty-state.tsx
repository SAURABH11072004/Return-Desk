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
    <div className="surface flex animate-fade-up flex-col items-center px-6 py-14 text-center">
      <div className="relative mb-5">
        <div aria-hidden className="absolute inset-0 scale-150 rounded-full bg-accent-soft blur-xl" />
        <span className="relative grid size-14 place-items-center rounded-2xl border border-line bg-surface shadow-raised">
          <Icon aria-hidden className="size-6 text-accent-text" />
        </span>
      </div>
      <h3 className="text-base font-semibold tracking-tight text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
