"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { ErrorAlert } from "@/components/alert";
import { Spinner } from "@/components/spinner";
import { StatusBadge } from "@/components/status-badge";
import { ApiRequestError, errorMessage } from "@/lib/api-client";
import type { ReturnDetail } from "@/lib/api-types";
import { REASON_LABELS, RESOLUTION_LABELS, STATUS_LABELS } from "@/lib/domain";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { ActionBar } from "./action-bar";
import { NotesPanel } from "./notes-panel";
import { useReturnDetail } from "./use-return-detail";

export function ReturnDetailView() {
  const reference = useParams<{ reference: string }>().reference.toUpperCase();
  const { data, error, loading, reload, replace } = useReturnDetail(reference);

  if (error instanceof ApiRequestError && error.status === 404) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold">{reference} is not on the desk</h1>
        <p className="mt-2 text-sm text-slate-600">It may have been removed, or the reference is wrong.</p>
        <Link href="/returns" className="mt-4 inline-block text-sm font-medium text-indigo-700 hover:underline">
          Back to the desk
        </Link>
      </div>
    );
  }
  if (error && !data) {
    return <ErrorAlert title={`Could not load ${reference}`} message={errorMessage(error)} onRetry={reload} />;
  }
  if (!data) {
    return (
      <div className="py-10 text-center">
        <Spinner label={`Loading ${reference}`} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link href="/returns" className="text-sm text-indigo-700 hover:underline">
          ← All requests
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">{data.reference}</h1>
          <StatusBadge status={data.status} />
          {loading && <Spinner label="Refreshing" />}
        </div>
        <p className="text-sm text-slate-600">
          Raised {formatDateTime(data.createdAt)} · last updated {formatDateTime(data.updatedAt)}
        </p>
      </div>

      <ActionBar detail={data} onUpdated={replace} onStale={reload} />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          <DetailsCard detail={data} />
          <NotesPanel detail={data} onUpdated={replace} />
        </div>
        <HistoryCard detail={data} />
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">{title}</h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="break-words text-sm text-slate-900">{children}</dd>
    </div>
  );
}

function DetailsCard({ detail }: { detail: ReturnDetail }) {
  return (
    <Card title="Request details">
      <dl className="grid gap-4 sm:grid-cols-2">
        <Detail label="Customer">{detail.customer.name}</Detail>
        <Detail label="Contact">
          <a href={`mailto:${detail.customer.email}`} className="text-indigo-700 hover:underline">
            {detail.customer.email}
          </a>
          {detail.customer.phone && <span className="block">{detail.customer.phone}</span>}
        </Detail>
        <Detail label="Order">
          {detail.order.orderNumber} <span className="text-slate-500">· placed {formatDate(detail.order.placedAt)}</span>
        </Detail>
        <Detail label="Item">
          {detail.item.productName}
          <span className="block text-xs text-slate-500">
            {detail.item.sku} · {formatMoney(detail.item.unitPrice)} each · {detail.item.orderedQuantity} ordered
          </span>
        </Detail>
        <Detail label="Units returned">{detail.quantity}</Detail>
        <Detail label="Reason">{REASON_LABELS[detail.reason]}</Detail>
        <Detail label="Resolution">
          {detail.resolution ? RESOLUTION_LABELS[detail.resolution] : <span className="text-slate-500">Not decided</span>}
        </Detail>
        {detail.refundAmount && <Detail label="Refund amount">{formatMoney(detail.refundAmount)}</Detail>}
      </dl>
      {!detail.allowedActions.canEdit && (
        <p className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          This request has been decided, so its customer and item details are locked. Notes can still be added.
        </p>
      )}
    </Card>
  );
}

function HistoryCard({ detail }: { detail: ReturnDetail }) {
  return (
    <Card title="Status history">
      <ol className="flex flex-col gap-3 text-sm">
        <li className="flex flex-col">
          <span className="font-medium text-slate-900">Raised as Open</span>
          <span className="text-xs text-slate-500">{formatDateTime(detail.createdAt)}</span>
        </li>
        {detail.statusHistory.map((change) => (
          <li key={`${change.to}-${change.changedAt}`} className="flex flex-col">
            <span className="font-medium text-slate-900">
              {STATUS_LABELS[change.from]} → {STATUS_LABELS[change.to]}
            </span>
            <span className="text-xs text-slate-500">{formatDateTime(change.changedAt)}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
