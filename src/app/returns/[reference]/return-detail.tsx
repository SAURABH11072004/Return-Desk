"use client";

import { ArrowLeft, FileQuestion, Lock } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { ErrorAlert } from "@/components/alert";
import { button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { ReturnTimeline } from "@/components/returns/timeline";
import { Skeleton } from "@/components/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { useApi } from "@/hooks/use-api";
import { ApiRequestError, errorMessage } from "@/lib/api-client";
import type { ReturnDetail } from "@/lib/api-types";
import { REASON_LABELS, RESOLUTION_LABELS } from "@/lib/domain";
import { formatDate, formatDateTime, formatMoney, formatRelative } from "@/lib/format";
import { ActionBar } from "./action-bar";
import { NotesPanel } from "./notes-panel";

export function ReturnDetailView() {
  const reference = useParams<{ reference: string }>().reference.toUpperCase();
  const { data: body, error, loading, reload, mutate } = useApi<{ data: ReturnDetail }>(`/api/returns/${encodeURIComponent(reference)}`);
  const data = body?.data?.reference === reference ? body.data : undefined;
  const replace = (detail: ReturnDetail) => mutate({ data: detail });

  if (error instanceof ApiRequestError && error.status === 404) {
    return (
      <div className="mx-auto max-w-lg py-6">
        <EmptyState
          icon={FileQuestion}
          title={`${reference} is not on the desk`}
          description="It may have been removed from the desk, or the reference is wrong. Removed requests are kept in the database but can no longer be opened."
          action={
            <Link href="/returns" className={button.secondary}>
              Back to returns
            </Link>
          }
        />
      </div>
    );
  }
  if (error && !data) {
    return <ErrorAlert title={`Could not load ${reference}`} message={errorMessage(error)} onRetry={reload} />;
  }
  if (!data) return <DetailSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 border-b border-line pb-5">
        <Link href="/returns" className="inline-flex w-fit items-center gap-1 text-[13px] text-muted transition-colors hover:text-ink">
          <ArrowLeft aria-hidden className="size-3.5" /> Returns
        </Link>
        {/* overflow-clip: the action dialogs render inside this block, and a focused input in them
            must not be able to scroll a clipped container. */}
        <div className="flex flex-col gap-4 overflow-clip lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="eyebrow">Return request</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-[28px] font-semibold tracking-[-0.02em] text-ink">{data.reference}</h1>
              <StatusBadge status={data.status} size="md" />
            </div>
            <p className="mt-1 text-[13px] text-muted">
              Created <time dateTime={data.createdAt} title={formatDateTime(data.createdAt)}>{formatRelative(data.createdAt)}</time>
              {" · "}updated <time dateTime={data.updatedAt} title={formatDateTime(data.updatedAt)}>{formatRelative(data.updatedAt)}</time>
              {loading && <span className="ml-2 text-faint">Refreshing…</span>}
            </p>
          </div>
          <ActionBar detail={data} onUpdated={replace} onStale={reload} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="details-title" className="panel">
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
              <h2 id="details-title" className="text-[15px] font-semibold text-ink">
                Details
              </h2>
              {!data.allowedActions.canEdit && (
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <Lock aria-hidden className="size-3.5" /> Locked after decision
                </span>
              )}
            </div>
            <dl className="divide-y divide-line">
              <Row label="Customer">
                <p className="text-ink">{data.customer.name}</p>
                <p className="text-muted">
                  <a href={`mailto:${data.customer.email}`} className="text-accent-text hover:underline">
                    {data.customer.email}
                  </a>
                  {data.customer.phone && <> · {data.customer.phone}</>}
                </p>
              </Row>
              <Row label="Order">
                <p className="font-mono text-ink">{data.order.orderNumber}</p>
                <p className="text-muted">Placed {formatDate(data.order.placedAt)}</p>
              </Row>
              <Row label="Item">
                <p className="text-ink">{data.item.productName}</p>
                <p className="text-muted">
                  <span className="font-mono">{data.item.sku}</span> · {formatMoney(data.item.unitPrice)} each
                </p>
              </Row>
              <Row label="Quantity">
                <p className="text-ink">
                  {data.quantity} <span className="text-muted">of {data.item.orderedQuantity} ordered</span>
                </p>
              </Row>
              <Row label="Reason">
                <p className="text-ink">{REASON_LABELS[data.reason]}</p>
              </Row>
              <Row label="Status">
                <StatusBadge status={data.status} />
              </Row>
              <Row label="Resolution">
                {data.resolution ? (
                  <p className="text-ink">
                    {RESOLUTION_LABELS[data.resolution]}
                    {data.refundAmount && <span className="font-medium tabular-nums"> · {formatMoney(data.refundAmount)}</span>}
                  </p>
                ) : (
                  <p className="text-muted">{data.status === "rejected" ? "None: the request was rejected" : "Chosen on approval"}</p>
                )}
              </Row>
            </dl>
          </section>

          <NotesPanel detail={data} onUpdated={replace} />
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <section aria-labelledby="timeline-title" className="panel px-5 py-4">
            <h2 id="timeline-title" className="text-[15px] font-semibold text-ink">
              Request timeline
            </h2>
            <p className="mb-4 text-xs text-muted">Every status change, in order.</p>
            <ReturnTimeline detail={data} />
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 border-b border-line pb-5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-full max-w-52" />
        <Skeleton className="h-3 w-full max-w-60" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
        <div className="panel divide-y divide-line">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex gap-4 px-5 py-3.5">
              <Skeleton className="h-3.5 w-20 shrink-0" />
              {/* flexible width: fixed bars overflowed 320px screens while loading */}
              <Skeleton className="h-3.5 w-full max-w-48" />
            </div>
          ))}
        </div>
        <div className="panel flex flex-col gap-4 p-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-3 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
