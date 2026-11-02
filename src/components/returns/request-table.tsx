"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import type { ReturnSummary } from "@/lib/api-types";
import { REASON_LABELS, RESOLUTION_LABELS } from "@/lib/domain";
import { formatDate, formatMoney, formatRelative } from "@/lib/format";

/** Desktop queue. Whole rows are clickable; the reference stays a real link for keyboard and new-tab use. */
export function RequestTable({ rows }: { rows: ReturnSummary[] }) {
  const router = useRouter();
  return (
    <div className="surface hidden overflow-hidden lg:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
            <th scope="col" className="py-3 pl-5 pr-3 font-semibold">Request</th>
            <th scope="col" className="px-3 py-3 font-semibold">Customer</th>
            <th scope="col" className="px-3 py-3 font-semibold">Order · Item</th>
            <th scope="col" className="px-3 py-3 font-semibold">Reason</th>
            <th scope="col" className="px-3 py-3 font-semibold">Status</th>
            <th scope="col" className="px-3 py-3 font-semibold">Resolution</th>
            <th scope="col" className="px-3 py-3 font-semibold">Created</th>
            <th scope="col" className="py-3 pl-3 pr-5 text-right font-semibold">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row, i) => (
            <tr
              key={row.reference}
              onClick={() => router.push(`/returns/${row.reference}`)}
              style={{ animationDelay: `${i * 25}ms` }}
              className="group animate-fade-in cursor-pointer transition-colors duration-150 hover:bg-surface-2"
            >
              <td className="py-3.5 pl-5 pr-3">
                <Link
                  href={`/returns/${row.reference}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-mono text-[13px] font-semibold text-ink group-hover:text-accent-text"
                >
                  {row.reference}
                </Link>
              </td>
              <td className="max-w-[200px] px-3 py-3.5">
                <div className="truncate font-medium text-ink">{row.customer.name}</div>
                <div className="truncate text-xs text-faint">{row.customer.email}</div>
              </td>
              <td className="max-w-[240px] px-3 py-3.5">
                <div className="font-mono text-[12px] text-ink-2">{row.order.orderNumber}</div>
                <div className="truncate text-xs text-faint">
                  {row.quantity} × {row.item.productName}
                </div>
              </td>
              <td className="px-3 py-3.5 text-ink-2">{REASON_LABELS[row.reason]}</td>
              <td className="px-3 py-3.5">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-3 py-3.5 text-ink-2">
                {row.resolution ? (
                  <>
                    <div>{RESOLUTION_LABELS[row.resolution]}</div>
                    {row.refundAmount && <div className="text-xs tabular-nums text-faint">{formatMoney(row.refundAmount)}</div>}
                  </>
                ) : (
                  <span className="text-faint">—</span>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-3.5">
                <div className="text-ink-2">{formatDate(row.createdAt)}</div>
                <div className="text-xs text-faint">{formatRelative(row.createdAt)}</div>
              </td>
              <td className="py-3.5 pl-3 pr-5 text-right">
                <span className="inline-flex size-8 items-center justify-center rounded-lg text-faint transition-all duration-200 group-hover:bg-surface group-hover:text-accent-text group-hover:shadow-card">
                  <ArrowUpRight aria-hidden className="size-4 transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-px" />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
