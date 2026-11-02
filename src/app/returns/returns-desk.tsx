"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorAlert } from "@/components/alert";
import { button } from "@/components/button";
import { inputClass } from "@/components/field";
import { Spinner } from "@/components/spinner";
import { StatusBadge } from "@/components/status-badge";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch, errorMessage, isAbort } from "@/lib/api-client";
import type { PageMeta, ReturnSummary } from "@/lib/api-types";
import { REASON_LABELS, RETURN_REASONS, RETURN_STATUSES, STATUS_LABELS, type ReturnStatus } from "@/lib/domain";
import { formatDate } from "@/lib/format";

type ListResponse = { data: ReturnSummary[]; meta: PageMeta };
/** The outcome of the most recent completed fetch, tagged with the request it answered. */
type Loaded = { key: string; result: ListResponse; error?: undefined } | { key: string; result?: undefined; error: string };

const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest first" },
  { value: "createdAt:asc", label: "Oldest first" },
  { value: "updatedAt:desc", label: "Recently updated" },
  { value: "customerName:asc", label: "Customer A–Z" },
  { value: "customerName:desc", label: "Customer Z–A" },
  { value: "reference:asc", label: "Reference" },
  { value: "status:asc", label: "Status (workflow order)" },
];

const SEARCH_DEBOUNCE_MS = 350;

/**
 * The desk. The URL query string is the single source of truth for search, filters, sort and
 * page; it is forwarded as-is to GET /api/returns, which does all the work in SQL.
 */
export function ReturnsDesk() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const queryString = params.toString();

  const statusFilter = (params.get("status") ?? "").split(",").filter(Boolean);
  const reasonFilter = params.get("reason") ?? "";
  const sortValue = `${params.get("sort") ?? "createdAt"}:${params.get("dir") ?? "desc"}`;
  const urlSearch = params.get("q") ?? "";

  const updateParams = useCallback(
    (changes: Record<string, string | null>, { resetPage = true } = {}) => {
      const next = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      if (resetPage) next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  // Search box: typed freely, pushed to the URL only after the user pauses.
  const [search, setSearch] = useState(urlSearch);
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const pushedSearch = useRef(urlSearch);
  useEffect(() => {
    if (debouncedSearch === pushedSearch.current) return;
    pushedSearch.current = debouncedSearch;
    updateParams({ q: debouncedSearch || null });
  }, [debouncedSearch, updateParams]);
  // Back/forward navigation changes the URL under us: reflect it in the box. URL changes we
  // pushed ourselves are skipped, so text typed since the last push is never overwritten.
  useEffect(() => {
    if (urlSearch === pushedSearch.current) return;
    pushedSearch.current = urlSearch;
    setSearch(urlSearch);
  }, [urlSearch]);

  // Each URL (plus a retry counter) is one request. A newer request aborts the older one, so a
  // slow response can never overwrite a fresher one. We are loading until the latest key answers.
  const [reloadCount, setReloadCount] = useState(0);
  const requestKey = `${queryString}#${reloadCount}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    apiFetch<ListResponse>(`/api/returns${queryString ? `?${queryString}` : ""}`, { signal: controller.signal })
      .then((result) => setLoaded({ key: requestKey, result }))
      .catch((error) => {
        if (!isAbort(error)) setLoaded({ key: requestKey, error: errorMessage(error) });
      });
    return () => controller.abort();
  }, [queryString, requestKey]);
  const loading = loaded?.key !== requestKey;

  const toggleStatus = (status: ReturnStatus) => {
    const next = statusFilter.includes(status) ? statusFilter.filter((s) => s !== status) : [...statusFilter, status];
    updateParams({ status: next.join(",") || null });
  };

  const hasFilters = Boolean(urlSearch || statusFilter.length || reasonFilter);
  const clearFilters = () => {
    setSearch("");
    pushedSearch.current = "";
    updateParams({ q: null, status: null, reason: null });
  };

  // While a new page loads, keep showing the previous results (dimmed) instead of flashing empty.
  const result = loaded?.result;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Return requests</h1>
        <p className="text-sm text-slate-600">Search, filter and work through the returns desk.</p>
      </div>

      <section aria-label="Search and filters" className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex-1">
            <label htmlFor="search" className="sr-only">
              Search
            </label>
            <input
              id="search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer, email, order number or reference"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 md:flex">
            <div>
              <label htmlFor="reason" className="sr-only">
                Reason
              </label>
              <select
                id="reason"
                value={reasonFilter}
                onChange={(e) => updateParams({ reason: e.target.value || null })}
                className={inputClass}
              >
                <option value="">All reasons</option>
                {RETURN_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {REASON_LABELS[reason]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sort" className="sr-only">
                Sort
              </label>
              <select
                id="sort"
                value={sortValue}
                onChange={(e) => {
                  const [sort, dir] = e.target.value.split(":");
                  updateParams({ sort, dir });
                }}
                className={inputClass}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by status">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</span>
          {RETURN_STATUSES.map((status) => {
            const active = statusFilter.includes(status);
            return (
              <button
                key={status}
                type="button"
                aria-pressed={active}
                onClick={() => toggleStatus(status)}
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                  active ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
                }`}
              >
                {STATUS_LABELS[status]}
              </button>
            );
          })}
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="ml-auto text-xs font-medium text-indigo-700 hover:underline">
              Clear filters
            </button>
          )}
        </div>
      </section>

      {!loading && loaded?.error && (
        <ErrorAlert title="Could not load return requests" message={loaded.error} onRetry={() => setReloadCount((n) => n + 1)} />
      )}

      {loading && !result && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
          <Spinner label="Loading return requests" />
        </div>
      )}

      {result && (
        <div className={`flex flex-col gap-3 transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
          {result.data.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="font-medium text-slate-900">No return requests match</p>
              <p className="mt-1 text-sm text-slate-600">
                {hasFilters ? "Try a different search or clear the filters." : "Nothing on the desk yet."}
              </p>
              {hasFilters ? (
                <button type="button" onClick={clearFilters} className={`${button.secondary} mt-4`}>
                  Clear filters
                </button>
              ) : (
                <Link href="/returns/new" className={`${button.primary} mt-4`}>
                  Raise a request
                </Link>
              )}
            </div>
          ) : (
            <>
              <ResultsTable rows={result.data} />
              <ResultsCards rows={result.data} />
            </>
          )}
          <Pagination meta={result.meta} onPage={(page) => updateParams({ page: String(page) }, { resetPage: false })} />
        </div>
      )}
    </div>
  );
}

function ResultsTable({ rows }: { rows: ReturnSummary[] }) {
  const router = useRouter();
  return (
    <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-3">Reference</th>
            <th scope="col" className="px-4 py-3">Status</th>
            <th scope="col" className="px-4 py-3">Customer</th>
            <th scope="col" className="px-4 py-3">Order / item</th>
            <th scope="col" className="px-4 py-3">Reason</th>
            <th scope="col" className="px-4 py-3">Raised</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr
              key={row.reference}
              onClick={() => router.push(`/returns/${row.reference}`)}
              className="cursor-pointer hover:bg-slate-50"
            >
              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                <Link href={`/returns/${row.reference}`} className="font-semibold text-indigo-700 hover:underline" onClick={(e) => e.stopPropagation()}>
                  {row.reference}
                </Link>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-slate-900">{row.customer.name}</div>
                <div className="text-xs text-slate-500">{row.customer.email}</div>
              </td>
              <td className="px-4 py-3">
                <div className="text-slate-900">{row.order.orderNumber}</div>
                <div className="text-xs text-slate-500">
                  {row.quantity} × {row.item.productName}
                </div>
              </td>
              <td className="px-4 py-3 text-slate-700">{REASON_LABELS[row.reason]}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(row.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultsCards({ rows }: { rows: ReturnSummary[] }) {
  return (
    <ul className="flex flex-col gap-2 md:hidden">
      {rows.map((row) => (
        <li key={row.reference}>
          <Link
            href={`/returns/${row.reference}`}
            className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 hover:border-indigo-300"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold text-indigo-700">{row.reference}</span>
              <StatusBadge status={row.status} />
            </div>
            <div>
              <div className="font-medium text-slate-900">{row.customer.name}</div>
              <div className="truncate text-xs text-slate-500">
                {row.order.orderNumber} · {row.quantity} × {row.item.productName}
              </div>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>{REASON_LABELS[row.reason]}</span>
              <span>{formatDate(row.createdAt)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Pagination({ meta, onPage }: { meta: PageMeta; onPage: (page: number) => void }) {
  if (meta.total === 0) return null;
  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.total);
  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-2 text-sm text-slate-600 sm:flex-row">
      <p>
        {from <= meta.total ? (
          <>
            Showing <span className="font-medium text-slate-900">{from}–{to}</span> of{" "}
            <span className="font-medium text-slate-900">{meta.total}</span>
          </>
        ) : (
          <>Page {meta.page} is past the end of {meta.total} results</>
        )}
      </p>
      <div className="flex items-center gap-2">
        <button type="button" className={button.secondary} disabled={meta.page <= 1} onClick={() => onPage(Math.min(meta.page - 1, meta.totalPages))}>
          Previous
        </button>
        <span className="px-1">
          Page {meta.page} of {Math.max(meta.totalPages, 1)}
        </span>
        <button type="button" className={button.secondary} disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>
          Next
        </button>
      </div>
    </nav>
  );
}
