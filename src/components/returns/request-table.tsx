"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import type { ReturnSummary } from "@/lib/api-types";
import { REASON_LABELS, RESOLUTION_LABELS } from "@/lib/domain";
import { formatDate, formatMoney, formatRelative } from "@/lib/format";

const th = "px-3 py-2.5 text-left text-xs font-medium text-muted";

/** Desktop queue. Whole rows are clickable; the reference stays a real link for keyboard and new-tab use. */
export function RequestTable({ rows }: { rows: ReturnSummary[] }) {
  const router = useRouter();
  return (
    <div className="hidden overflow-hidden rounded-xl border border-line bg-surface lg:block">
      <table className="w-full text-sm">
        <thead className="border-b border-line bg-surface-2">
          <tr>
            <th scope="col" className={`${th} pl-4`}>Request</th>
            <th scope="col" className={th}>Customer</th>
            <th scope="col" className={th}>Order · Item</th>
            <th scope="col" className={th}>Reason</th>
            <th scope="col" className={th}>Status</th>
            <th scope="col" className={th}>Resolution</th>
            <th scope="col" className={th}>Created</th>
            <th scope="col" className="w-8 pr-3">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr
              key={row.reference}
              onClick={() => router.push(`/returns/${row.reference}`)}
              className="group cursor-pointer transition-colors duration-100 hover:bg-surface-2"
            >
              <td className="py-3 pl-4 pr-3 align-top">
                <Link
                  href={`/returns/${row.reference}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-mono text-[13px] font-medium text-ink hover:text-accent-text hover:underline"
                >
                  {row.reference}
                </Link>
              </td>
              <td className="max-w-[200px] px-3 py-3 align-top">
                <div className="truncate text-ink">{row.customer.name}</div>
                <div className="truncate text-xs text-muted">{row.customer.email}</div>
              </td>
              <td className="max-w-[240px] px-3 py-3 align-top">
                <div className="truncate text-ink">
                  {row.quantity} × {row.item.productName}
                </div>
                <div className="font-mono text-xs text-muted">{row.order.orderNumber}</div>
              </td>
              <td className="px-3 py-3 align-top text-ink-2">{REASON_LABELS[row.reason]}</td>
              <td className="px-3 py-3 align-top">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-3 py-3 align-top text-ink-2">
                {row.resolution ? (
                  <>
                    <div>{RESOLUTION_LABELS[row.resolution]}</div>
                    {row.refundAmount && <div className="text-xs tabular-nums text-muted">{formatMoney(row.refundAmount)}</div>}
                  </>
                ) : (
                  <span className="text-faint">—</span>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-3 align-top">
                <div className="text-ink-2">{formatDate(row.createdAt)}</div>
                <div className="text-xs text-muted">{formatRelative(row.createdAt)}</div>
              </td>
              <td className="py-3 pr-3 align-top">
                <ChevronRight aria-hidden className="mt-0.5 size-4 text-line-strong transition-colors group-hover:text-muted" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
