import { Circle, Flag, Plus } from "lucide-react";
import { STATUS_META } from "@/components/status-meta";
import type { ReturnDetail } from "@/lib/api-types";
import { RESOLUTION_LABELS, type ReturnStatus } from "@/lib/domain";
import { formatDate, formatMoney, formatTime } from "@/lib/format";

type Event = { key: string; title: string; detail?: string; at: string; status: ReturnStatus | "created" };

const EVENT_TITLES: Record<ReturnStatus, string> = {
  open: "Reopened",
  in_review: "Moved to review",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
};

/** What is still ahead for a request in each status (from the lifecycle, not invented activity). */
const UPCOMING: Record<ReturnStatus, string[]> = {
  open: ["Review", "Decision: approve or reject", "Completion"],
  in_review: ["Decision: approve or reject", "Completion, if approved"],
  approved: ["Completion"],
  rejected: [],
  completed: [],
};

/**
 * Vertical timeline built only from recorded data: creation time plus every row of the status
 * history. Steps not reached yet are drawn hollow and labelled as upcoming.
 */
export function ReturnTimeline({ detail }: { detail: ReturnDetail }) {
  const events: Event[] = [
    { key: "created", title: "Return request created", detail: `${detail.quantity} × ${detail.item.productName}`, at: detail.createdAt, status: "created" },
    ...detail.statusHistory.map((change, i) => ({
      key: `${i}-${change.to}`,
      title: EVENT_TITLES[change.to],
      detail:
        change.to === "approved" && detail.resolution
          ? `${RESOLUTION_LABELS[detail.resolution]}${detail.refundAmount ? ` · ${formatMoney(detail.refundAmount)}` : ""}`
          : STATUS_META[change.to].description,
      at: change.changedAt,
      status: change.to,
    })),
  ];
  const upcoming = UPCOMING[detail.status];
  const closed = upcoming.length === 0;

  return (
    <ol className="relative">
      {events.map((event, i) => {
        const meta = event.status === "created" ? null : STATUS_META[event.status];
        const Icon = meta?.icon ?? Plus;
        const last = i === events.length - 1 && closed;
        return (
          <li key={event.key} className="relative flex animate-fade-up gap-3.5 pb-6" style={{ animationDelay: `${i * 70}ms` }}>
            {!last && <span aria-hidden className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-line-strong" />}
            <span
              className={`relative z-10 grid size-8 shrink-0 place-items-center rounded-full border shadow-card ${
                meta ? meta.badge : "border-accent/30 bg-accent-soft text-accent-text"
              }`}
            >
              <Icon aria-hidden className="size-4" />
            </span>
            <div className="min-w-0 pt-1">
              <p className="text-sm font-medium text-ink">{event.title}</p>
              {event.detail && <p className="mt-0.5 text-xs text-muted">{event.detail}</p>}
              <p className="mt-1 text-[11px] tabular-nums text-faint">
                <time dateTime={event.at}>
                  {formatDate(event.at)} · {formatTime(event.at)}
                </time>
              </p>
            </div>
          </li>
        );
      })}
      {upcoming.map((step, i) => (
        <li
          key={step}
          className="relative flex animate-fade-up gap-3.5 pb-6 last:pb-0"
          style={{ animationDelay: `${(events.length + i) * 70}ms` }}
        >
          {i < upcoming.length - 1 && (
            <span aria-hidden className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px border-l border-dashed border-line-strong" />
          )}
          <span className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-line-strong bg-surface text-faint">
            <Circle aria-hidden className="size-3" />
          </span>
          <div className="pt-1.5">
            <p className="text-sm text-muted">{step}</p>
            <p className="text-[11px] uppercase tracking-[0.12em] text-faint">Upcoming</p>
          </div>
        </li>
      ))}
      {closed && (
        <li className="flex animate-fade-in items-center gap-2 pl-1 text-xs text-faint" style={{ animationDelay: `${events.length * 70}ms` }}>
          <Flag aria-hidden className="size-3.5" /> This request is closed. Its status is final.
        </li>
      )}
    </ol>
  );
}
