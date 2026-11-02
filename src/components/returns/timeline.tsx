import { STATUS_META } from "@/components/status-meta";
import type { ReturnDetail } from "@/lib/api-types";
import { RESOLUTION_LABELS, type ReturnStatus } from "@/lib/domain";
import { formatDate, formatMoney, formatTime } from "@/lib/format";

type Event = { key: string; title: string; detail?: string; at: string; dot: string };

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
    { key: "created", title: "Request created", detail: `${detail.quantity} × ${detail.item.productName}`, at: detail.createdAt, dot: "bg-ink-2" },
    ...detail.statusHistory.map((change, i) => ({
      key: `${i}-${change.to}`,
      title: EVENT_TITLES[change.to],
      detail:
        change.to === "approved" && detail.resolution
          ? `${RESOLUTION_LABELS[detail.resolution]}${detail.refundAmount ? ` · ${formatMoney(detail.refundAmount)}` : ""}`
          : undefined,
      at: change.changedAt,
      dot: STATUS_META[change.to].dot,
    })),
  ];
  const upcoming = UPCOMING[detail.status];

  return (
    <ol className="relative">
      {/* one continuous rail behind all markers */}
      <span aria-hidden className="absolute bottom-2 left-[5px] top-2 w-px bg-line" />
      {events.map((event) => (
        <li key={event.key} className="relative flex gap-3 pb-5">
          <span aria-hidden className={`relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-surface ${event.dot}`} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">{event.title}</p>
            {event.detail && <p className="text-[13px] text-muted">{event.detail}</p>}
            <p className="mt-0.5 text-xs tabular-nums text-faint">
              <time dateTime={event.at}>
                {formatDate(event.at)}, {formatTime(event.at)}
              </time>
            </p>
          </div>
        </li>
      ))}
      {upcoming.map((step) => (
        <li key={step} className="relative flex gap-3 pb-5 last:pb-0">
          <span aria-hidden className="relative mt-1.5 size-[11px] shrink-0 rounded-full border border-line-strong bg-surface" />
          <p className="text-sm text-faint">
            {step} <span className="text-xs">· upcoming</span>
          </p>
        </li>
      ))}
      {upcoming.length === 0 && (
        <li className="relative flex gap-3">
          <span aria-hidden className="relative mt-1.5 size-[11px] shrink-0 rounded-full border border-line-strong bg-surface-3" />
          <p className="text-sm text-muted">Closed. The status is final.</p>
        </li>
      )}
    </ol>
  );
}
