import { Lock } from "lucide-react";
import { STATUS_META } from "@/components/status-meta";
import type { ReturnStats } from "@/lib/api-types";
import { TRANSITIONS, type ReturnStatus } from "@/lib/domain";

/**
 * The real state machine, drawn. Every connector corresponds to an entry in TRANSITIONS
 * (lib/domain.ts); the assertion below fails loudly in development if they ever drift apart.
 */
const EDGES: [ReturnStatus, ReturnStatus][] = [
  ["open", "in_review"],
  ["in_review", "approved"],
  ["in_review", "rejected"],
  ["approved", "completed"],
];
if (process.env.NODE_ENV !== "production") {
  const drawn = new Set(EDGES.map(([a, b]) => `${a}>${b}`));
  const real = Object.entries(TRANSITIONS).flatMap(([from, tos]) => tos.map((to) => `${from}>${to}`));
  if (real.length !== drawn.size || real.some((edge) => !drawn.has(edge))) {
    throw new Error("WorkflowVisualization is out of sync with TRANSITIONS");
  }
}

export function WorkflowVisualization({ stats, unavailable = false }: { stats: ReturnStats | undefined; unavailable?: boolean }) {
  // null = counts could not be loaded (shown as a dash); undefined = still loading (skeleton).
  const count = (s: ReturnStatus) => (unavailable ? null : stats?.byStatus[s]);

  return (
    <section aria-labelledby="workflow-title" className="surface relative overflow-hidden p-5 sm:p-6 lg:p-8">
      <div aria-hidden className="dot-grid absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="relative flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="workflow-title" className="text-lg font-semibold tracking-tight sm:text-xl">
            Return workflow
          </h2>
          <p className="mt-1 text-sm text-muted">How a request moves through the desk, with how many are at each stage now.</p>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-faint">
          <Lock aria-hidden className="size-3.5" /> Rejected and Completed are final
        </p>
      </div>

      {/* md and up: Open → In Review → Approved → Completed, with Rejected branching from In Review. */}
      <div className="relative mt-8 hidden md:grid md:grid-cols-[1fr_minmax(28px,64px)_1fr_minmax(28px,64px)_1fr_minmax(28px,64px)_1fr] md:items-center">
        <Node status="open" count={count("open")} step={1} />
        <Connector />
        <Node status="in_review" count={count("in_review")} step={2} />
        <Connector />
        <Node status="approved" count={count("approved")} step={3} />
        <Connector />
        <Node status="completed" count={count("completed")} step={4} final />

        <div className="col-start-3 flex h-12 justify-center">
          <Connector vertical label="or" />
        </div>
        <div className="col-start-3">
          <Node status="rejected" count={count("rejected")} final />
        </div>
      </div>

      {/* Small screens: the same graph, vertical. */}
      <ol className="relative mt-6 flex flex-col md:hidden">
        <li><Node status="open" count={count("open")} step={1} /></li>
        <li className="flex h-8 justify-center"><Connector vertical /></li>
        <li><Node status="in_review" count={count("in_review")} step={2} /></li>
        <li className="grid h-8 grid-cols-2">
          <span className="flex justify-center"><Connector vertical /></span>
          <span className="flex justify-center"><Connector vertical label="or" /></span>
        </li>
        <li className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col">
            <Node status="approved" count={count("approved")} step={3} compact />
            <span className="flex h-8 justify-center"><Connector vertical /></span>
            <Node status="completed" count={count("completed")} step={4} final compact />
          </div>
          <Node status="rejected" count={count("rejected")} final compact />
        </li>
      </ol>
    </section>
  );
}

function Node({
  status,
  count,
  step,
  final = false,
  compact = false,
}: {
  status: ReturnStatus;
  count: number | null | undefined;
  step?: number;
  final?: boolean;
  compact?: boolean;
}) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <div className={`group relative rounded-2xl border bg-surface shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-raised ${meta.ring} ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`relative grid shrink-0 place-items-center rounded-xl border ${meta.badge} ${compact ? "size-9" : "size-11"}`}>
          {status === "open" && (
            <span aria-hidden className={`absolute inset-0 animate-ping-soft rounded-xl ${meta.soft}`} />
          )}
          <Icon aria-hidden className={`relative ${compact ? "size-4" : "size-5"}`} />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
          {step ? `Step ${step}` : "Branch"}
        </span>
      </div>
      <p className={`mt-3 font-semibold tracking-tight text-ink ${compact ? "text-sm" : "text-[15px]"}`}>
        {meta.label}
        {final && <span className="ml-1.5 rounded-md bg-surface-3 px-1.5 py-0.5 align-middle text-[10px] font-medium text-muted">Final</span>}
      </p>
      <p className="mt-0.5 text-xs text-muted">{meta.description}</p>
      <p className="mt-3 flex items-baseline gap-1.5">
        {count === null ? (
          <span className="text-xl font-semibold text-faint">—</span>
        ) : count === undefined ? (
          <span className="skeleton inline-block h-5 w-8" />
        ) : (
          <span className={`text-xl font-semibold tabular-nums ${meta.text}`}>{count}</span>
        )}
        <span className="text-xs text-faint">on desk</span>
      </p>
    </div>
  );
}

/** Animated dashed connector with an arrowhead. */
function Connector({ vertical = false, label }: { vertical?: boolean; label?: string }) {
  return (
    <span aria-hidden className={`relative flex items-center justify-center text-line-strong ${vertical ? "h-full w-4 flex-col" : "h-4 w-full"}`}>
      <svg className={vertical ? "h-full w-2" : "h-2 w-full"} preserveAspectRatio="none" viewBox={vertical ? "0 0 2 100" : "0 0 100 2"}>
        <line
          x1={vertical ? 1 : 0}
          y1={vertical ? 0 : 1}
          x2={vertical ? 1 : 100}
          y2={vertical ? 100 : 1}
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
          className="animate-flow"
        />
      </svg>
      <svg className={`absolute size-2.5 text-faint ${vertical ? "bottom-0 rotate-90" : "right-0"}`} viewBox="0 0 10 10">
        <path d="M2 1l5 4-5 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label && (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line bg-surface px-1.5 text-[10px] font-medium text-faint">
          {label}
        </span>
      )}
    </span>
  );
}
