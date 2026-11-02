import { ChevronRight, CornerDownRight } from "lucide-react";
import { STATUS_META } from "@/components/status-meta";
import type { ReturnStats } from "@/lib/api-types";
import { TRANSITIONS, type ReturnStatus } from "@/lib/domain";

/**
 * The real state machine, as a numbered process. Every arrow corresponds to an entry in
 * TRANSITIONS (lib/domain.ts); the assertion below fails loudly in development if they drift apart.
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

const MAIN_PATH: ReturnStatus[] = ["open", "in_review", "approved", "completed"];

export function WorkflowVisualization({ stats, unavailable = false }: { stats: ReturnStats | undefined; unavailable?: boolean }) {
  // null = counts could not be loaded (shown as a dash); undefined = still loading (skeleton).
  const count = (s: ReturnStatus) => (unavailable ? null : stats?.byStatus[s]);

  return (
    <section aria-labelledby="workflow-title" className="panel px-4 py-5 sm:px-6">
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 id="workflow-title" className="text-[15px] font-semibold text-ink">
          How a return moves
        </h2>
        <p className="text-xs text-muted">Rejected and Completed are final.</p>
      </div>

      <ol className="mt-4 grid gap-3 md:grid-cols-4 md:gap-0">
        {MAIN_PATH.map((status, i) => {
          const meta = STATUS_META[status];
          return (
            <li key={status} className="relative flex gap-3 md:pr-6">
              <span className="font-mono text-xs font-medium leading-6 text-faint">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                  <span aria-hidden className={`size-2 rounded-full ${meta.dot}`} />
                  {meta.label}
                </p>
                <p className="text-xs text-muted">{meta.description}</p>
                <Count value={count(status)} />
                {status === "in_review" && (
                  <p className="mt-2.5 flex items-start gap-1.5 border-t border-dashed border-line pt-2.5 text-xs text-muted">
                    <CornerDownRight aria-hidden className="mt-px size-3.5 shrink-0 text-faint" />
                    <span>
                      or <span className="font-medium text-rejected-fg">Rejected</span>: request declined
                      <Count value={count("rejected")} inline />
                    </span>
                  </p>
                )}
              </div>
              {i < MAIN_PATH.length - 1 && (
                <ChevronRight aria-hidden className="absolute right-2 top-1 hidden size-4 text-line-strong md:block" />
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Count({ value, inline = false }: { value: number | null | undefined; inline?: boolean }) {
  const content =
    value === null ? "—" : value === undefined ? <span className="skeleton inline-block h-3 w-5 align-middle" /> : value;
  return inline ? (
    <span className="text-faint">
      {" · "}
      <span className="tabular-nums text-ink-2">{content}</span>
    </span>
  ) : (
    <p className="mt-1.5 text-xs text-faint">
      <span className="font-medium tabular-nums text-ink-2">{content}</span> on desk
    </p>
  );
}
