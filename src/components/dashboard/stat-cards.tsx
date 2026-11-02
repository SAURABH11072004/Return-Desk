import { ArrowDownRight, ArrowUpRight, Layers } from "lucide-react";
import { Skeleton } from "@/components/skeleton";
import { STATUS_META } from "@/components/status-meta";
import type { ReturnStats } from "@/lib/api-types";
import { RETURN_STATUSES, type ReturnStatus } from "@/lib/domain";

const KPI_STATUSES: { status: ReturnStatus; caption: string }[] = [
  { status: "open", caption: "Waiting to be picked up" },
  { status: "in_review", caption: "Awaiting a decision" },
  { status: "approved", caption: "Ready to complete" },
  { status: "completed", caption: "Closed out" },
];

const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);

/**
 * Desk KPIs. Every number comes from GET /api/returns/stats; clicking a status card filters the
 * queue below to that status (an ordinary server-side filter).
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
    <section aria-label="Desk overview" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
      <TotalCard stats={stats} />
      {KPI_STATUSES.map(({ status, caption }, i) => {
        const meta = STATUS_META[status];
        const Icon = meta.icon;
        const count = stats.byStatus[status];
        const share = pct(count, stats.total);
        const active = activeStatus.length === 1 && activeStatus[0] === status;
        return (
          <button
            key={status}
            type="button"
            onClick={() => onSelectStatus(status)}
            aria-pressed={active}
            aria-label={`${meta.label}: ${count} requests. Show only ${meta.label}.`}
            style={{ animationDelay: `${60 + i * 50}ms` }}
            className={`surface surface-lift group relative flex animate-fade-up flex-col overflow-hidden p-4 text-left sm:p-5 ${
              active ? `ring-2 ring-accent ring-offset-2 ring-offset-canvas` : ""
            }`}
          >
            <span aria-hidden className={`absolute inset-x-0 top-0 h-0.5 ${meta.dot} opacity-70`} />
            <span className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{meta.label}</span>
              <span className={`grid size-8 place-items-center rounded-lg border transition-transform duration-300 group-hover:scale-110 ${meta.badge}`}>
                <Icon aria-hidden className="size-4" />
              </span>
            </span>
            <span className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-ink">{count}</span>
            <span className="mt-0.5 text-xs text-faint">{caption}</span>
            <span className="mt-4 flex items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                <span className={`block h-full rounded-full ${meta.dot} transition-[width] duration-700 ease-out`} style={{ width: `${share}%` }} />
              </span>
              <span className="text-[11px] tabular-nums text-faint">{share}%</span>
            </span>
          </button>
        );
      })}
    </section>
  );
}

function TotalCard({ stats }: { stats: ReturnStats }) {
  return (
    <div className="relative col-span-2 flex animate-fade-up flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-[#4f46e5] via-[#4338ca] to-[#312e81] p-5 text-white shadow-floating md:col-span-1 xl:col-span-2">
      <div aria-hidden className="absolute -right-10 -top-16 size-48 rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/15" />
      <div className="relative flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">Total returns</span>
        <span className="grid size-8 place-items-center rounded-lg bg-white/15 ring-1 ring-white/20">
          <Layers aria-hidden className="size-4" />
        </span>
      </div>
      <div className="relative mt-3 flex items-end gap-3">
        <span className="text-5xl font-semibold tabular-nums tracking-tight">{stats.total}</span>
        <span className="mb-1.5 text-sm text-white/70">on the desk</span>
      </div>
      {/* Real distribution of the desk across all five statuses. */}
      <div className="relative mt-4 flex h-2 overflow-hidden rounded-full bg-white/15" aria-hidden>
        {RETURN_STATUSES.map((s) => (
          <span key={s} className={`${STATUS_META[s].dot} h-full`} style={{ width: `${pct(stats.byStatus[s], stats.total)}%` }} />
        ))}
      </div>
      <div className="relative mt-4 grid grid-cols-2 gap-2 text-xs">
        <span className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5">
          <ArrowUpRight aria-hidden className="size-3.5 text-emerald-300" />
          <span className="font-semibold tabular-nums">{stats.raisedLast7Days}</span>
          <span className="text-white/70">raised · 7d</span>
        </span>
        <span className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5">
          <ArrowDownRight aria-hidden className="size-3.5 text-sky-300" />
          <span className="font-semibold tabular-nums">{stats.closedLast7Days}</span>
          <span className="text-white/70">closed · 7d</span>
        </span>
      </div>
    </div>
  );
}

function StatCardsSkeleton() {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
      <Skeleton className="col-span-2 h-[178px] rounded-2xl md:col-span-1 xl:col-span-2" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="surface flex flex-col gap-3 p-5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-12" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-1.5 w-full" />
        </div>
      ))}
    </div>
  );
}
