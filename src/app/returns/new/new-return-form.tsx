"use client";

import { ArrowRight, LoaderCircle, Search, ShoppingBag, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ErrorAlert } from "@/components/alert";
import { button } from "@/components/button";
import { useToast } from "@/components/toast";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch, ApiRequestError, errorMessage, fieldErrors, isAbort } from "@/lib/api-client";
import type { OrderDetail, OrderSummary, ReturnDetail } from "@/lib/api-types";
import { REASON_LABELS } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { createReturnSchema, toFieldIssues } from "@/lib/validation";
import { CustomerFields, ItemPicker, QuantityField, ReasonPicker, toPayload, type RequestFormValues } from "../_components/request-fields";

const EMPTY_VALUES: RequestFormValues = { sku: "", quantity: "1", reason: "", customer: { name: "", email: "", phone: "" } };

/**
 * Raising a return. The order comes first because it decides which items can be returned and
 * pre-fills the customer's contact details; the rest of the form unlocks once it is chosen.
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
  const summary = [order?.orderNumber, item && `${values.quantity} × ${item.productName}`, values.reason && REASON_LABELS[values.reason]]
    .filter(Boolean)
    .join(" · ");

  return (
    <form onSubmit={submit} noValidate className="panel">
      <Section title="Order" description="Search by order number, customer name or email.">
        {order ? (
          <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
            <ShoppingBag aria-hidden className="size-4 shrink-0 text-muted" />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm font-medium text-ink">{order.orderNumber}</p>
              <p className="truncate text-xs text-muted">
                {order.customer.name} · placed {formatDate(order.placedAt)}
              </p>
            </div>
            <button type="button" className={button.smallSecondary} onClick={() => setOrder(null)}>
              Change
            </button>
          </div>
        ) : (
          <OrderFinder onChoose={chooseOrder} />
        )}
      </Section>

      <Section title="Item" description="The item coming back, and how many units." disabled={!order}>
        {order ? (
          <div className="flex flex-col gap-4">
            <ItemPicker order={order} value={values.sku} onChange={(sku) => update({ sku })} error={errors.sku} />
            <QuantityField value={values.quantity} onChange={(quantity) => update({ quantity })} error={errors.quantity} max={item?.quantity} />
          </div>
        ) : (
          <Placeholder>Choose an order first.</Placeholder>
        )}
      </Section>

      <Section title="Customer" description="Pre-filled from the order. Correct anything that has changed." disabled={!order}>
        <CustomerFields values={values.customer} onChange={(customer) => update({ customer })} errors={errors} />
      </Section>

      <Section title="Reason" description="Why the item is being returned." disabled={!order}>
        <ReasonPicker value={values.reason} onChange={(reason) => update({ reason })} error={errors.reason} hideLegend />
      </Section>

      {formError && (
        <div className="border-t border-line px-5 py-4 sm:px-6">
          <ErrorAlert message={formError} />
        </div>
      )}
      <div className="flex flex-col gap-3 rounded-b-xl border-t border-line bg-surface-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="min-w-0 truncate text-[13px] text-muted">
          {summary || "Nothing selected yet."}
          <span className="hidden text-faint md:inline"> · A reference like RD-000123 is generated on save.</span>
        </p>
        <div className="flex shrink-0 gap-2">
          <button type="button" className={button.secondary} onClick={() => router.push("/returns")}>
            Cancel
          </button>
          <button type="submit" className={button.primary} disabled={pending || !order}>
            {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {pending ? "Creating…" : "Create return"}
          </button>
        </div>
      </div>
    </form>
  );
}

/** A form row: what it is on the left, the fields on the right (stacked on small screens). */
function Section({ title, description, disabled = false, children }: { title: string; description: string; disabled?: boolean; children: ReactNode }) {
  return (
    <section className="grid gap-3 border-b border-line px-5 py-5 sm:px-6 md:grid-cols-[220px_minmax(0,1fr)] md:gap-8">
      <div>
        <h2 className={`text-sm font-semibold ${disabled ? "text-muted" : "text-ink"}`}>{title}</h2>
        <p className="mt-0.5 text-[13px] text-muted">{description}</p>
      </div>
      <fieldset disabled={disabled} className={`min-w-0 transition-opacity ${disabled ? "opacity-50" : ""}`}>
        {children}
      </fieldset>
    </section>
  );
}

function Placeholder({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line-strong px-3 py-3 text-[13px] text-muted">{children}</p>;
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
    <div className="flex flex-col gap-2">
      <label htmlFor="order-search" className="sr-only">
        Find an order
      </label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <input
          id="order-search"
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. ORD-10012 or Priya"
          autoFocus
          className="h-9 w-full rounded-lg border border-line-strong bg-surface pl-9 pr-9 text-sm text-ink placeholder:text-faint transition-[border-color,box-shadow] hover:border-[#c4c2bc] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 [&::-webkit-search-cancel-button]:hidden"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
          {searching ? (
            <LoaderCircle aria-label="Searching" className="size-4 animate-spin text-muted" />
          ) : (
            input && (
              <button type="button" onClick={() => setInput("")} aria-label="Clear" className="grid size-6 place-items-center rounded text-faint hover:bg-surface-3">
                <X className="size-3.5" />
              </button>
            )
          )}
        </span>
      </div>
      {current?.error && <ErrorAlert message={current.error} />}
      {chooseError && <ErrorAlert message={chooseError} />}
      {term && current?.results?.length === 0 && <Placeholder>No orders match “{term}”.</Placeholder>}
      {term && current?.results && current.results.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
          {current.results.map((order) => (
            <li key={order.orderNumber}>
              <button
                type="button"
                onClick={() => void choose(order.orderNumber)}
                disabled={loadingOrder !== null}
                className="group flex w-full items-center gap-3 bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-2 disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-sm font-medium text-ink">{order.orderNumber}</span>
                  <span className="block truncate text-xs text-muted">
                    {order.customer.name} · {order.customer.email} · {formatDate(order.placedAt)}
                  </span>
                </span>
                {loadingOrder === order.orderNumber ? (
                  <LoaderCircle aria-hidden className="size-4 animate-spin text-muted" />
                ) : (
                  <ArrowRight aria-hidden className="size-4 text-faint transition-colors group-hover:text-ink" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!term && <p className="text-xs text-muted">Try an order number such as ORD-10036, or part of a customer’s name.</p>}
    </div>
  );
}
