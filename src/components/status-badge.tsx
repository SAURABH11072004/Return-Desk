import { STATUS_LABELS, type ReturnStatus } from "@/lib/domain";

const STYLES: Record<ReturnStatus, { badge: string; dot: string }> = {
  open: { badge: "bg-sky-50 text-sky-800 ring-sky-600/30", dot: "bg-sky-500" },
  in_review: { badge: "bg-amber-50 text-amber-900 ring-amber-600/30", dot: "bg-amber-500" },
  approved: { badge: "bg-emerald-50 text-emerald-800 ring-emerald-600/30", dot: "bg-emerald-500" },
  rejected: { badge: "bg-rose-50 text-rose-800 ring-rose-600/30", dot: "bg-rose-500" },
  completed: { badge: "bg-slate-100 text-slate-700 ring-slate-500/30", dot: "bg-slate-500" },
};

/** Colour plus text label, so status reads at a glance and never relies on colour alone. */
export function StatusBadge({ status }: { status: ReturnStatus }) {
  const style = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style.badge}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}
