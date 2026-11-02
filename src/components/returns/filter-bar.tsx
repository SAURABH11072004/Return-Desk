"use client";

import { ArrowUpDown, ListFilter, LoaderCircle, Search, Tag, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Dropdown } from "@/components/dropdown";
import { STATUS_META } from "@/components/status-meta";
import type { DeskFilters } from "@/hooks/use-desk-filters";
import { REASON_LABELS, RETURN_REASONS, RETURN_STATUSES, type ReturnReason, type ReturnStatus } from "@/lib/domain";

export const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest first" },
  { value: "createdAt:asc", label: "Oldest first" },
  { value: "updatedAt:desc", label: "Recently updated" },
  { value: "customerName:asc", label: "Customer A–Z" },
  { value: "customerName:desc", label: "Customer Z–A" },
  { value: "reference:asc", label: "Reference" },
  { value: "status:asc", label: "Workflow stage" },
];

/** Search, filter and sort controls. All of it changes the URL; the server does the work. */
export function FilterBar({ filters, total, loading }: { filters: DeskFilters; total: number | undefined; loading: boolean }) {
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" jumps to search, like most command bars.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key !== "/" || target.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const busy = loading || filters.searchPending;
  const chips = [
    ...(filters.appliedSearch ? [{ key: "q", label: `“${filters.appliedSearch}”`, remove: filters.clearSearch }] : []),
    ...filters.status.map((s) => ({
      key: `status-${s}`,
      label: STATUS_META[s].label,
      remove: () => filters.setStatus(filters.status.filter((x) => x !== s)),
    })),
    ...(filters.reason ? [{ key: "reason", label: REASON_LABELS[filters.reason], remove: () => filters.setReason("") }] : []),
  ];

  return (
    <div className="surface p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <label htmlFor="search" className="sr-only">
            Search returns
          </label>
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            ref={searchRef}
            id="search"
            type="search"
            value={filters.search}
            onChange={(e) => filters.setSearch(e.target.value)}
            placeholder="Search by customer, email, order or reference"
            className="h-11 w-full rounded-xl border border-line bg-surface-2 pl-10 pr-20 text-sm text-ink placeholder:text-faint transition-[border-color,box-shadow,background-color] duration-150 hover:border-line-strong focus:border-accent focus:bg-surface focus:outline-none focus:ring-4 focus:ring-accent/15 [&::-webkit-search-cancel-button]:hidden"
          />
          <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
            {busy && <LoaderCircle aria-label="Searching" className="size-4 animate-spin text-accent" />}
            {filters.search ? (
              <button
                type="button"
                onClick={filters.clearSearch}
                aria-label="Clear search"
                className="grid size-6 place-items-center rounded-md text-faint hover:bg-surface-3 hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            ) : (
              <kbd className="hidden rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-faint sm:inline">/</kbd>
            )}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
          <Dropdown<ReturnStatus>
            label="Status"
            icon={ListFilter}
            multiple
            options={RETURN_STATUSES.map((s) => ({
              value: s,
              label: STATUS_META[s].label,
              icon: STATUS_META[s].icon,
              iconClass: STATUS_META[s].text,
            }))}
            selected={filters.status}
            onChange={filters.setStatus}
            summary={filters.status.length === 1 ? STATUS_META[filters.status[0]].label : `${filters.status.length} statuses`}
          />
          <Dropdown<ReturnReason | "">
            label="Reason"
            icon={Tag}
            options={[{ value: "", label: "All reasons" }, ...RETURN_REASONS.map((r) => ({ value: r, label: REASON_LABELS[r] }))]}
            selected={filters.reason ? [filters.reason] : []}
            onChange={([r]) => filters.setReason(r ?? "")}
            summary={filters.reason ? REASON_LABELS[filters.reason] : undefined}
          />
          <div className="col-span-2 sm:col-span-1">
            <Dropdown<string>
              label="Sort"
              icon={ArrowUpDown}
              align="right"
              neutral
              options={SORT_OPTIONS}
              selected={[filters.sort]}
              onChange={([s]) => filters.setSort(s)}
              summary={SORT_OPTIONS.find((o) => o.value === filters.sort)?.label ?? "Sort"}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex min-h-7 flex-wrap items-center gap-2 text-sm" aria-live="polite">
        <span className="text-muted">
          {total === undefined ? (
            "Loading returns…"
          ) : (
            <>
              <span className="font-semibold tabular-nums text-ink">{total}</span> {total === 1 ? "return" : "returns"}
              {filters.hasFilters ? " match" : " on the desk"}
            </>
          )}
        </span>
        {chips.map((chip) => (
          <span
            key={chip.key}
            className="inline-flex animate-scale-in items-center gap-1 rounded-full border border-line bg-surface-2 py-0.5 pl-2.5 pr-1 text-xs font-medium text-ink-2"
          >
            {chip.label}
            <button
              type="button"
              onClick={chip.remove}
              aria-label={`Remove filter ${chip.label}`}
              className="grid size-5 place-items-center rounded-full text-faint hover:bg-surface-3 hover:text-ink"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        {filters.hasFilters && (
          <button type="button" onClick={filters.clearAll} className="ml-auto text-xs font-medium text-accent-text hover:underline">
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
