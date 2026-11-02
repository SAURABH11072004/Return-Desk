import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import type { ReturnSummary } from "@/lib/api-types";
import { REASON_LABELS, RESOLUTION_LABELS } from "@/lib/domain";
import { formatRelative } from "@/lib/format";

/** The queue on phones and tablets: a stacked list with the same information as a table row. */
export function RequestCards({ rows }: { rows: ReturnSummary[] }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface lg:hidden">
      {rows.map((row) => (
        <li key={row.reference}>
          <Link href={`/returns/${row.reference}`} className="flex flex-col gap-1.5 px-4 py-3.5 transition-colors active:bg-surface-3 hover:bg-surface-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[13px] font-medium text-ink">{row.reference}</span>
              <StatusBadge status={row.status} />
            </div>
            <p className="truncate text-sm text-ink">
              {row.customer.name}
              <span className="text-muted"> · {row.quantity} × {row.item.productName}</span>
            </p>
            <p className="flex items-center justify-between gap-2 text-xs text-muted">
              <span className="truncate">
                <span className="font-mono">{row.order.orderNumber}</span> · {REASON_LABELS[row.reason]}
                {row.resolution && <> · {RESOLUTION_LABELS[row.resolution]}</>}
              </span>
              <span className="shrink-0">{formatRelative(row.createdAt)}</span>
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
