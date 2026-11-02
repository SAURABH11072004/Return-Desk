"use client";

import { ArrowRight, Check, LoaderCircle, Search, ShoppingBag, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ErrorAlert } from "@/components/alert";
import { button } from "@/components/button";
import { useToast } from "@/components/toast";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch, ApiRequestError, errorMessage, fieldErrors, isAbort } from "@/lib/api-client";
import type { OrderDetail, OrderSummary, ReturnDetail } from "@/lib/api-types";
import { REASON_LABELS } from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import { createReturnSchema, toFieldIssues } from "@/lib/validation";
import { CustomerFields, ItemPicker, QuantityField, ReasonPicker, toPayload, type RequestFormValues } from "../_components/request-fields";

const EMPTY_VALUES: RequestFormValues = { sku: "", quantity: "1", reason: "", customer: { name: "", email: "", phone: "" } };

/**
 * Raising a return, as a guided flow: 01 order & item → 02 customer → 03 return details →
 * 04 review. The order comes first because it determines which items can be returned and
 * pre-fills the customer's contact details.
 */
export function NewReturnForm() {
  const router = useRouter();
  const toast = useToast();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [values, setValues] = useState<RequestFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const update = (patch: Partial<RequestFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    // Clear the messages for whatever the agent just corrected.
    const touched = Object.keys(patch);
    setErrors((errs) => Object.fromEntries(Object.entries(errs).filter(([path]) => !touched.includes(path.split(".")[0]))));
    setFormError(null);
  };

  const chooseOrder = (chosen: OrderDetail) => {
    setOrder(chosen);
    setValues({
      ...EMPTY_VALUES,
      customer: { name: chosen.customer.name, email: chosen.customer.email, phone: chosen.customer.phone ?? "" },
    });
    setErrors({});
    setFormError(null);
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!order) return;
    const check = createReturnSchema.safeParse({ orderNumber: order.orderNumber, ...toPayload(values) });
    if (!check.success) {
      setErrors(fieldErrors(toFieldIssues(check.error)));
      setFormError("Some details need attention before the return can be raised.");
      return;
    }
    setPending(true);
    setErrors({});
    setFormError(null);
    try {
      const { data } = await apiFetch<{ data: ReturnDetail }>("/api/returns", { method: "POST", json: check.data });
      toast.success(`Return ${data.reference} created`, `${data.quantity} × ${data.item.productName} for ${data.customer.name}.`);
      router.push(`/returns/${data.reference}`);
    } catch (err) {
      const message = errorMessage(err);
      setFormError(message);
      toast.error("The return was not raised", message);
      if (err instanceof ApiRequestError) setErrors(fieldErrors(err.issues));
      setPending(false);
    }
  }

  const item = order?.items.find((i) => i.sku === values.sku);

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Section number="01" title="Order & item" description="Find the order, then choose the item that is coming back.">
          {order ? (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-3">
                <span className="grid size-10 place-items-center rounded-xl border border-line bg-surface text-ink-2">
                  <ShoppingBag aria-hidden className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-semibold text-ink">{order.orderNumber}</p>
                  <p className="truncate text-xs text-muted">
                    {order.customer.name} · placed {formatDate(order.placedAt)}
                  </p>
                </div>
                <button type="button" className={button.smallGhost} onClick={() => setOrder(null)}>
                  Change
                </button>
              </div>
              <ItemPicker order={order} value={values.sku} onChange={(sku) => update({ sku })} error={errors.sku} />
            </div>
          ) : (
            <OrderFinder onChoose={chooseOrder} />
          )}
        </Section>

        <Section number="02" title="Customer" description="Pre-filled from the order. Correct anything that has changed." disabled={!order}>
          <CustomerFields values={values.customer} onChange={(customer) => update({ customer })} errors={errors} />
        </Section>

        <Section number="03" title="Return details" description="How many units, and why they are coming back." disabled={!order}>
          <div className="flex flex-col gap-5">
            <QuantityField value={values.quantity} onChange={(quantity) => update({ quantity })} error={errors.quantity} max={item?.quantity} />
            <ReasonPicker value={values.reason} onChange={(reason) => update({ reason })} error={errors.reason} />
          </div>
        </Section>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="surface overflow-hidden">
          <div className="border-b border-line bg-surface-2 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
              <span className="font-mono text-accent-text">04</span> · Review
            </p>
            <p className="mt-1 text-sm text-muted">Check the summary, then raise the return.</p>
          </div>
          <dl className="flex flex-col divide-y divide-line px-5 text-sm">
            <SummaryRow label="Order" done={Boolean(order)}>
              {order ? <span className="font-mono">{order.orderNumber}</span> : null}
            </SummaryRow>
            <SummaryRow label="Item" done={Boolean(item)}>
              {item ? (
                <>
                  {item.productName}
                  <span className="block text-xs text-faint">{formatMoney(item.unitPrice)} each</span>
                </>
              ) : null}
            </SummaryRow>
            <SummaryRow label="Units" done={Boolean(item) && Number(values.quantity) >= 1}>
              {item ? values.quantity : null}
            </SummaryRow>
            <SummaryRow label="Reason" done={Boolean(values.reason)}>
              {values.reason ? REASON_LABELS[values.reason] : null}
            </SummaryRow>
            <SummaryRow label="Customer" done={Boolean(values.customer.name && values.customer.email)}>
              {values.customer.name ? (
                <>
                  {values.customer.name}
                  <span className="block truncate text-xs text-faint">{values.customer.email}</span>
                </>
              ) : null}
            </SummaryRow>
          </dl>
          <div className="flex flex-col gap-3 border-t border-line p-5">
            {formError && <ErrorAlert message={formError} />}
            <button type="submit" className={`${button.primary} w-full`} disabled={pending || !order}>
              {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <ArrowRight aria-hidden className="size-4" />}
              {pending ? "Raising return…" : "Raise return"}
            </button>
            <p className="text-center text-xs text-faint">A reference like RD-000123 is generated for you.</p>
          </div>
        </div>
      </aside>
    </form>
  );
}

function Section({
  number,
  title,
  description,
  disabled = false,
  children,
}: {
  number: string;
  title: string;
  description: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`surface p-5 transition-opacity duration-300 sm:p-6 ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <div className="mb-5 flex gap-4">
        <span className="font-mono text-sm font-semibold text-accent-text">{number}</span>
        <div>
          <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
          <p className="mt-0.5 text-sm text-muted">{description}</p>
        </div>
      </div>
      <fieldset disabled={disabled} className="sm:pl-8">
        {children}
      </fieldset>
    </section>
  );
}

function SummaryRow({ label, done, children }: { label: string; done: boolean; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span
        aria-hidden
        className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full transition-colors ${done ? "bg-success text-white" : "border border-dashed border-line-strong"}`}
      >
        {done && <Check className="size-2.5" strokeWidth={3.5} />}
      </span>
      <dt className="w-20 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-right font-medium text-ink">{children ?? <span className="font-normal text-faint">—</span>}</dd>
    </div>
  );
}

type SearchResult = { term: string; results?: OrderSummary[]; error?: string };

/** Debounced order lookup by order number, customer name or email. */
function OrderFinder({ onChoose }: { onChoose: (order: OrderDetail) => void }) {
  const [input, setInput] = useState("");
  const term = useDebouncedValue(input.trim(), 300);
  const [search, setSearch] = useState<SearchResult | null>(null);
  const [loadingOrder, setLoadingOrder] = useState<string | null>(null);
  const [chooseError, setChooseError] = useState<string | null>(null);

  useEffect(() => {
    if (!term) return;
    const controller = new AbortController();
    apiFetch<{ data: OrderSummary[] }>(`/api/orders?q=${encodeURIComponent(term)}`, { signal: controller.signal })
      .then(({ data }) => setSearch({ term, results: data }))
      .catch((err) => {
        if (!isAbort(err)) setSearch({ term, error: errorMessage(err) });
      });
    return () => controller.abort();
  }, [term]);

  async function choose(orderNumber: string) {
    setLoadingOrder(orderNumber);
    setChooseError(null);
    try {
      const { data } = await apiFetch<{ data: OrderDetail }>(`/api/orders/${encodeURIComponent(orderNumber)}`);
      onChoose(data);
    } catch (err) {
      setChooseError(errorMessage(err));
    } finally {
      setLoadingOrder(null);
    }
  }

  const current = search?.term === term ? search : null;
  const searching = Boolean(input.trim()) && (!current || input.trim() !== term);

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="order-search" className="text-[13px] font-medium text-ink-2">
        Search by order number, customer name or email
      </label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <input
          id="order-search"
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. ORD-10012 or Priya"
          autoFocus
          className="h-11 w-full rounded-xl border border-line bg-surface-2 pl-10 pr-10 text-sm text-ink placeholder:text-faint transition-[border-color,box-shadow,background-color] hover:border-line-strong focus:border-accent focus:bg-surface focus:outline-none focus:ring-4 focus:ring-accent/15 [&::-webkit-search-cancel-button]:hidden"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          {searching ? (
            <LoaderCircle aria-label="Searching" className="size-4 animate-spin text-accent" />
          ) : (
            input && (
              <button type="button" onClick={() => setInput("")} aria-label="Clear" className="grid size-6 place-items-center rounded-md text-faint hover:bg-surface-3">
                <X className="size-3.5" />
              </button>
            )
          )}
        </span>
      </div>
      {current?.error && <ErrorAlert message={current.error} />}
      {chooseError && <ErrorAlert message={chooseError} />}
      {term && current?.results?.length === 0 && (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">No orders match “{term}”.</p>
      )}
      {term && current?.results && current.results.length > 0 && (
        <ul className="flex animate-fade-in flex-col overflow-hidden rounded-xl border border-line">
          {current.results.map((order) => (
            <li key={order.orderNumber} className="border-b border-line last:border-0">
              <button
                type="button"
                onClick={() => void choose(order.orderNumber)}
                disabled={loadingOrder !== null}
                className="group flex w-full items-center gap-3 bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-2 disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-sm font-semibold text-ink">{order.orderNumber}</span>
                  <span className="block truncate text-xs text-muted">
                    {order.customer.name} · {order.customer.email} · {formatDate(order.placedAt)}
                  </span>
                </span>
                {loadingOrder === order.orderNumber ? (
                  <LoaderCircle aria-hidden className="size-4 animate-spin text-accent" />
                ) : (
                  <ArrowRight aria-hidden className="size-4 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent-text" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!term && <p className="text-xs text-faint">Tip: try an order number such as ORD-10036, or part of a customer’s name.</p>}
    </div>
  );
}
