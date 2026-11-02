import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PageMeta } from "@/lib/api-types";

/** Compact page list: 1 … 4 5 6 … 12 */
function pageItems(page: number, totalPages: number): (number | "gap")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? (["gap", p] as const) : [p]));
}

export function Pagination({ meta, onPage }: { meta: PageMeta; onPage: (page: number) => void }) {
  if (meta.total === 0) return null;
  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.total);
  const pastEnd = from > meta.total;
  const navButton =
    "inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-surface px-2.5 text-sm text-ink-2 shadow-card transition-colors hover:border-line-strong hover:text-ink disabled:pointer-events-none disabled:opacity-40";

  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-muted">
        {pastEnd ? (
          <>Page {meta.page} is past the end of the results.</>
        ) : (
          <>
            Showing <span className="font-medium tabular-nums text-ink">{from}–{to}</span> of{" "}
            <span className="font-medium tabular-nums text-ink">{meta.total}</span>
          </>
        )}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className={navButton}
          disabled={meta.page <= 1}
          onClick={() => onPage(Math.min(meta.page - 1, Math.max(meta.totalPages, 1)))}
        >
          <ChevronLeft aria-hidden className="size-4" />
          <span className="hidden sm:inline">Previous</span>
        </button>
        <span className="hidden items-center gap-1 sm:flex">
          {pageItems(meta.page, meta.totalPages).map((item, i) =>
            item === "gap" ? (
              <span key={`gap-${i}`} className="px-1 text-faint">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPage(item)}
                aria-current={item === meta.page ? "page" : undefined}
                className={`h-9 min-w-9 rounded-lg px-2 text-sm tabular-nums transition-colors ${
                  item === meta.page ? "bg-ink font-semibold text-canvas" : "text-ink-2 hover:bg-surface-3"
                }`}
              >
                {item}
              </button>
            ),
          )}
        </span>
        <span className="px-2 text-sm tabular-nums text-muted sm:hidden">
          {meta.page} / {Math.max(meta.totalPages, 1)}
        </span>
        <button type="button" className={navButton} disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>
          <span className="hidden sm:inline">Next</span>
          <ChevronRight aria-hidden className="size-4" />
        </button>
      </div>
    </nav>
  );
}
