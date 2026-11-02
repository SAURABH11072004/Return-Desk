"use client";

import { ArrowLeft, FileQuestion, Lock, Package, ShoppingBag, Tag, User, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { ErrorAlert } from "@/components/alert";
import { button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { ReturnTimeline } from "@/components/returns/timeline";
import { Skeleton } from "@/components/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { RESOLUTION_META, STATUS_META } from "@/components/status-meta";
import { useApi } from "@/hooks/use-api";
import { ApiRequestError, errorMessage } from "@/lib/api-client";
import type { ReturnDetail } from "@/lib/api-types";
import { REASON_LABELS, RESOLUTIONS, RESOLUTION_LABELS } from "@/lib/domain";
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
            <Link href="/returns" className={button.primary}>
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

  const meta = STATUS_META[data.status];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/returns" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> All returns
      </Link>

      <header className="surface relative overflow-hidden p-5 sm:p-7">
        <div aria-hidden className={`absolute -right-20 -top-20 size-64 rounded-full blur-3xl ${meta.soft} opacity-80`} />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">Return request</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{data.reference}</h1>
              <StatusBadge status={data.status} size="md" />
            </div>
            <p className="mt-2 text-sm text-muted">
              Created <time dateTime={data.createdAt} title={formatDateTime(data.createdAt)}>{formatRelative(data.createdAt)}</time>
              <span className="mx-1.5 text-faint">·</span>
              Updated <time dateTime={data.updatedAt} title={formatDateTime(data.updatedAt)}>{formatRelative(data.updatedAt)}</time>
              {loading && <span className="ml-2 text-faint">Refreshing…</span>}
            </p>
          </div>
          <ActionBar detail={data} onUpdated={replace} onStale={reload} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-label="Request details" className="grid gap-4 sm:grid-cols-2">
            <InfoCard icon={User} label="Customer">
              <p className="font-medium text-ink">{data.customer.name}</p>
              <a href={`mailto:${data.customer.email}`} className="block truncate text-sm text-accent-text hover:underline">
                {data.customer.email}
              </a>
              {data.customer.phone && <p className="text-sm text-muted">{data.customer.phone}</p>}
            </InfoCard>
            <InfoCard icon={ShoppingBag} label="Order">
              <p className="font-mono font-medium text-ink">{data.order.orderNumber}</p>
              <p className="text-sm text-muted">Placed {formatDate(data.order.placedAt)}</p>
            </InfoCard>
            <InfoCard icon={Package} label="Item">
              <p className="font-medium text-ink">{data.item.productName}</p>
              <p className="text-sm text-muted">
                <span className="font-semibold text-ink-2">{data.quantity}</span> of {data.item.orderedQuantity} returned ·{" "}
                {formatMoney(data.item.unitPrice)} each
              </p>
              <p className="font-mono text-xs text-faint">{data.item.sku}</p>
            </InfoCard>
            <InfoCard icon={Tag} label="Reason">
              <p className="font-medium text-ink">{REASON_LABELS[data.reason]}</p>
              <p className="text-sm text-muted">Given when the request was raised</p>
            </InfoCard>
          </section>

          {!data.allowedActions.canEdit && (
            <p className="-mt-2 flex items-center gap-2 text-xs text-faint">
              <Lock aria-hidden className="size-3.5" />
              Decided requests are locked: customer and item details can no longer change. Notes can still be added.
            </p>
          )}

          <ResolutionCard detail={data} />
          <NotesPanel detail={data} onUpdated={replace} />
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <section className="surface p-5">
            <h2 className="text-sm font-semibold text-ink">Return timeline</h2>
            <p className="mb-5 mt-0.5 text-xs text-muted">Every status change, in order.</p>
            <ReturnTimeline detail={data} />
          </section>
        </aside>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="surface surface-lift flex gap-3.5 p-4 sm:p-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-surface-2 text-ink-2">
        <Icon aria-hidden className="size-[18px]" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{label}</p>
        {children}
      </div>
    </div>
  );
}

function ResolutionCard({ detail }: { detail: ReturnDetail }) {
  return (
    <section className="surface p-5 sm:p-6" aria-labelledby="resolution-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="resolution-title" className="text-sm font-semibold text-ink">
          Resolution
        </h2>
        <p className="text-xs text-muted">
          {detail.resolution
            ? "Chosen when the request was approved"
            : detail.status === "rejected"
              ? "No resolution: the request was rejected"
              : "Chosen when the request is approved"}
        </p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {RESOLUTIONS.map((option) => {
          const Icon = RESOLUTION_META[option].icon;
          const chosen = detail.resolution === option;
          return (
            <div
              key={option}
              className={`relative rounded-xl border p-4 transition-all ${
                chosen ? "border-approved-line bg-approved-bg shadow-raised" : "border-line bg-surface-2 opacity-60"
              }`}
            >
              <Icon aria-hidden className={`size-5 ${chosen ? "text-approved-fg" : "text-faint"}`} />
              <p className={`mt-3 text-sm font-medium ${chosen ? "text-approved-fg" : "text-muted"}`}>{RESOLUTION_LABELS[option]}</p>
              {chosen && detail.refundAmount && (
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{formatMoney(detail.refundAmount)}</p>
              )}
              {chosen && <span className="sr-only">(selected)</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DetailSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <Skeleton className="h-4 w-24" />
      <div className="surface flex flex-col gap-3 p-7">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="surface flex gap-3.5 p-5">
              <Skeleton className="size-10 rounded-xl" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          ))}
        </div>
        <div className="surface flex flex-col gap-5 p-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3.5">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
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
