"use client";

import { Inbox, Plus, SearchX } from "lucide-react";
import Link from "next/link";
import { ErrorAlert } from "@/components/alert";
import { button } from "@/components/button";
import { StatCards } from "@/components/dashboard/stat-cards";
import { WorkflowVisualization } from "@/components/dashboard/workflow-visualization";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/returns/filter-bar";
import { Pagination } from "@/components/returns/pagination";
import { QueueSkeleton } from "@/components/returns/queue-skeleton";
import { RequestCards } from "@/components/returns/request-card";
import { RequestTable } from "@/components/returns/request-table";
import { useApi } from "@/hooks/use-api";
import { useDeskFilters } from "@/hooks/use-desk-filters";
import { errorMessage } from "@/lib/api-client";
import type { PageMeta, ReturnStats, ReturnSummary } from "@/lib/api-types";
import type { ReturnStatus } from "@/lib/domain";

type ListResponse = { data: ReturnSummary[]; meta: PageMeta };

/**
 * The returns desk: overview, workflow and the queue. This component only wires data to views;
 * filtering, sorting and paging all happen in SQL behind GET /api/returns.
 */
export function ReturnsDesk() {
  const filters = useDeskFilters();
  const list = useApi<ListResponse>(`/api/returns${filters.queryString ? `?${filters.queryString}` : ""}`);
  const stats = useApi<{ data: ReturnStats }>("/api/returns/stats");

  const selectStatus = (status: ReturnStatus) => {
    const only = filters.status.length === 1 && filters.status[0] === status;
    filters.setStatus(only ? [] : [status]);
    document.getElementById("queue")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const result = list.error ? undefined : list.data;
  const statsFailed = Boolean(stats.error) && !stats.loading;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[32px]">Return operations</h1>
        <p className="mt-1.5 text-[15px] text-muted">Manage customer return requests from intake through resolution.</p>
      </header>

      <div className="flex flex-col gap-4">
        {statsFailed ? (
          <ErrorAlert title="Could not load the overview" message={errorMessage(stats.error)} onRetry={stats.reload} />
        ) : (
          <StatCards stats={stats.data?.data} activeStatus={filters.status} onSelectStatus={selectStatus} />
        )}
        <WorkflowVisualization stats={stats.data?.data} unavailable={statsFailed} />
      </div>

      <section id="queue" aria-labelledby="queue-title" className="flex scroll-mt-20 flex-col gap-3">
        <div className="border-b border-line pb-3">
          <h2 id="queue-title" className="text-[22px] font-semibold tracking-[-0.01em] text-ink">
            Return queue
          </h2>
          <p className="mt-0.5 text-sm text-muted">Every request on the desk. Open one to work it.</p>
        </div>

        <FilterBar filters={filters} total={result?.meta.total} loading={list.loading} failed={Boolean(list.error) && !list.loading} />

        {Boolean(list.error) && !list.loading && (
          <ErrorAlert title="Could not load return requests" message={errorMessage(list.error)} onRetry={list.reload} />
        )}

        {!result && !list.error && <QueueSkeleton />}

        {result && (
          <div className={`flex flex-col gap-3 transition-opacity duration-150 ${list.loading ? "opacity-60" : ""}`} aria-busy={list.loading}>
            {result.data.length === 0 ? (
              filters.hasFilters ? (
                <EmptyState
                  icon={SearchX}
                  title="No returns match these filters"
                  description="Try a different search term, or clear the filters to see the whole queue."
                  action={
                    <button type="button" onClick={filters.clearAll} className={button.secondary}>
                      Clear filters
                    </button>
                  }
                />
              ) : (
                <EmptyState
                  icon={Inbox}
                  title="The queue is clear"
                  description="There are no return requests on the desk. New requests will appear here as they are raised."
                  action={
                    <Link href="/returns/new" className={button.primary}>
                      <Plus aria-hidden className="size-4" />
                      New return
                    </Link>
                  }
                />
              )
            ) : (
              <>
                <RequestTable rows={result.data} />
                <RequestCards rows={result.data} />
              </>
            )}
            <Pagination meta={result.meta} onPage={filters.setPage} />
          </div>
        )}
      </section>
    </div>
  );
}
