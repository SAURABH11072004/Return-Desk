"use client";

import { Plus, SearchX } from "lucide-react";
import Link from "next/link";
import { ErrorAlert } from "@/components/alert";
import { button } from "@/components/button";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
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
 * The dashboard: overview, workflow and the queue. This component only wires data to views;
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

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <DashboardHeader />

      {stats.error ? (
        <ErrorAlert title="Could not load the overview" message={errorMessage(stats.error)} onRetry={stats.reload} />
      ) : (
        <StatCards stats={stats.data?.data} activeStatus={filters.status} onSelectStatus={selectStatus} />
      )}

      <WorkflowVisualization stats={stats.data?.data} unavailable={Boolean(stats.error) && !stats.loading} />

      <section id="queue" aria-labelledby="queue-title" className="flex scroll-mt-24 flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="queue-title" className="text-xl font-semibold tracking-tight sm:text-2xl">
              Return queue
            </h2>
            <p className="mt-1 text-sm text-muted">Every request on the desk. Open one to work it.</p>
          </div>
        </div>

        <FilterBar filters={filters} total={result?.meta.total} loading={list.loading} failed={Boolean(list.error) && !list.loading} />

        {Boolean(list.error) && !list.loading && (
          <ErrorAlert title="Could not load return requests" message={errorMessage(list.error)} onRetry={list.reload} />
        )}

        {!result && !list.error && <QueueSkeleton />}

        {result && (
          <div className={`flex flex-col gap-4 transition-opacity duration-200 ${list.loading ? "opacity-60" : ""}`} aria-busy={list.loading}>
            {result.data.length === 0 ? (
              filters.hasFilters ? (
                <EmptyState
                  icon={SearchX}
                  title="No returns found"
                  description="Nothing matches these filters. Try a different search, or clear the filters to see the whole queue."
                  action={
                    <button type="button" onClick={filters.clearAll} className={button.secondary}>
                      Clear filters
                    </button>
                  }
                />
              ) : (
                <EmptyState
                  icon={SearchX}
                  title="Your return queue is clear"
                  description="There are no return requests on the desk. New requests will appear here."
                  action={
                    <Link href="/returns/new" className={button.primary}>
                      <Plus aria-hidden className="size-4" />
                      Create return
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
