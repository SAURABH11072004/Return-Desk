import { ChevronRight, Package } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import type { ReturnSummary } from "@/lib/api-types";
import { REASON_LABELS, RESOLUTION_LABELS } from "@/lib/domain";
import { formatRelative } from "@/lib/format";

/** The queue on phones and tablets: one card per request, same information as a table row. */
export function RequestCards({ rows }: { rows: ReturnSummary[] }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2 lg:hidden">
      {rows.map((row, i) => (
        <li key={row.reference} className="animate-fade-up" style={{ animationDelay: `${i * 30}ms` }}>
          <Link href={`/returns/${row.reference}`} className="surface surface-lift flex h-full flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[13px] font-semibold text-ink">{row.reference}</span>
              <StatusBadge status={row.status} />
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">{row.customer.name}</p>
              <p className="truncate text-xs text-faint">{row.customer.email}</p>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl bg-surface-2 p-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface text-faint">
                <Package aria-hidden className="size-4" />
              </span>
              <div className="min-w-0 text-xs">
                <p className="truncate font-medium text-ink-2">
                  {row.quantity} × {row.item.productName}
                </p>
                <p className="font-mono text-faint">{row.order.orderNumber}</p>
              </div>
            </div>
            <div className="mt-auto flex items-center justify-between text-xs text-muted">
              <span>
                {REASON_LABELS[row.reason]}
                {row.resolution && <> · {RESOLUTION_LABELS[row.resolution]}</>}
              </span>
              <span className="flex items-center gap-1 text-faint">
                {formatRelative(row.createdAt)}
                <ChevronRight aria-hidden className="size-3.5" />
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
