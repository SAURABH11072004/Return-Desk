import { Skeleton } from "@/components/skeleton";
import { STATUS_META } from "@/components/status-meta";
import type { ReturnStats } from "@/lib/api-types";
import type { ReturnStatus } from "@/lib/domain";

const KPI_STATUSES: { status: ReturnStatus; caption: string }[] = [
  { status: "open", caption: "Waiting to be reviewed" },
  { status: "in_review", caption: "Awaiting a decision" },
  { status: "approved", caption: "Ready to complete" },
  { status: "completed", caption: "Closed out" },
];

const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);

/**
 * Desk KPIs as one strip. Every number comes from GET /api/returns/stats; clicking a status
 * filters the queue below to that status (an ordinary server-side filter).
 */
export function StatCards({
  stats,
  activeStatus,
  onSelectStatus,
}: {
  stats: ReturnStats | undefined;
  activeStatus: ReturnStatus[];
  onSelectStatus: (status: ReturnStatus) => void;
}) {
  if (!stats) return <StatCardsSkeleton />;

  return (
    <section
      aria-label="Desk overview"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-5"
    >
      <div className="col-span-2 flex flex-col bg-surface-2 p-4 sm:p-5 md:col-span-1">
        <span className="eyebrow">Total returns</span>
        <span className="mt-2 text-[28px] font-semibold leading-none tabular-nums tracking-tight text-ink">{stats.total}</span>
        <span className="mt-2 text-xs text-muted">
          {stats.raisedLast7Days} new · {stats.closedLast7Days} closed this week
        </span>
      </div>
      {KPI_STATUSES.map(({ status, caption }) => {
        const meta = STATUS_META[status];
        const count = stats.byStatus[status];
        const active = activeStatus.length === 1 && activeStatus[0] === status;
        return (
          <button
            key={status}
            type="button"
            onClick={() => onSelectStatus(status)}
            aria-pressed={active}
            aria-label={`${meta.label}: ${count} requests. ${active ? "Clear this filter." : `Show only ${meta.label}.`}`}
            className={`group flex flex-col p-4 text-left transition-colors sm:p-5 ${
              active ? "bg-accent-soft" : "bg-surface hover:bg-surface-2"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span aria-hidden className={`size-2 rounded-full ${meta.dot}`} />
              <span className={`eyebrow ${active ? "text-accent-text" : ""}`}>{meta.label}</span>
            </span>
            <span className="mt-2 text-[28px] font-semibold leading-none tabular-nums tracking-tight text-ink">{count}</span>
            <span className="mt-2 text-xs text-muted">
              {caption} · {pct(count, stats.total)}%
            </span>
          </button>
        );
      })}
    </section>
  );
}

function StatCardsSkeleton() {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-5">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className={`flex flex-col gap-2.5 bg-surface p-5 ${i === 0 ? "col-span-2 md:col-span-1" : ""}`}>
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-10" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}
