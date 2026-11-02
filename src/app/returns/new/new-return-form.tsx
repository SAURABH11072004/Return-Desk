"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorAlert } from "@/components/alert";
import { button } from "@/components/button";
import { inputClass } from "@/components/field";
import { Spinner } from "@/components/spinner";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch, ApiRequestError, errorMessage, fieldErrors, isAbort } from "@/lib/api-client";
import type { OrderDetail, OrderSummary, ReturnDetail } from "@/lib/api-types";
import { formatDate } from "@/lib/format";
import { createReturnSchema, toFieldIssues } from "@/lib/validation";
import {
  CustomerFields,
  ItemPicker,
  QuantityAndReasonFields,
  toPayload,
  type RequestFormValues,
} from "../_components/request-fields";

const EMPTY_VALUES: RequestFormValues = { sku: "", quantity: "1", reason: "", customer: { name: "", email: "", phone: "" } };

export function NewReturnForm() {
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [values, setValues] = useState<RequestFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const update = (patch: Partial<RequestFormValues>) => setValues((v) => ({ ...v, ...patch }));

  const chooseOrder = (chosen: OrderDetail) => {
    setOrder(chosen);
    // Prefill contact details from the order's customer; the agent can correct them.
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
      return;
    }
    setPending(true);
    setErrors({});
    setFormError(null);
    try {
      const { data } = await apiFetch<{ data: ReturnDetail }>("/api/returns", { method: "POST", json: check.data });
      router.push(`/returns/${data.reference}`);
    } catch (err) {
      setFormError(errorMessage(err));
      if (err instanceof ApiRequestError) setErrors(fieldErrors(err.issues));
      setPending(false);
    }
  }

  const selectedItem = order?.items.find((item) => item.sku === values.sku);

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">1. Order</h2>
        {order ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{order.orderNumber}</p>
              <p className="text-sm text-slate-600">
                {order.customer.name} · placed {formatDate(order.placedAt)}
              </p>
            </div>
            <button type="button" className={button.secondary} onClick={() => setOrder(null)}>
              Change order
            </button>
          </div>
        ) : (
          <OrderFinder onChoose={chooseOrder} />
        )}
      </section>

      {order && (
        <form onSubmit={submit} noValidate className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">2. What is being returned</h2>
          <ItemPicker order={order} value={values.sku} onChange={(sku) => update({ sku })} error={errors.sku} />
          <QuantityAndReasonFields values={values} onChange={update} errors={errors} maxQuantity={selectedItem?.quantity} />
          <h2 className="border-t border-slate-100 pt-4 text-sm font-semibold text-slate-900">3. Customer</h2>
          <CustomerFields values={values.customer} onChange={(customer) => update({ customer })} errors={errors} />
          {formError && <ErrorAlert title="The request was not raised" message={formError} />}
          <div className="flex justify-end">
            <button type="submit" className={button.primary} disabled={pending}>
              {pending ? "Raising…" : "Raise request"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

type Search = { term: string; results?: OrderSummary[]; error?: string };

/** Debounced order lookup by order number, customer name or email. */
function OrderFinder({ onChoose }: { onChoose: (order: OrderDetail) => void }) {
  const [input, setInput] = useState("");
  const term = useDebouncedValue(input.trim(), 300);
  const [search, setSearch] = useState<Search | null>(null);
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
  const searching = Boolean(term) && !current;

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="order-search" className="text-sm text-slate-700">
        Search by order number, customer name or email
      </label>
      <input
        id="order-search"
        type="search"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="e.g. ORD-10012 or Priya"
        className={inputClass}
        autoFocus
      />
      {searching && <Spinner label="Searching orders" />}
      {current?.error && <ErrorAlert message={current.error} />}
      {chooseError && <ErrorAlert message={chooseError} />}
      {term && current?.results?.length === 0 && <p className="text-sm text-slate-600">No orders match “{term}”.</p>}
      {term && current?.results && current.results.length > 0 && (
        <ul className="flex flex-col divide-y divide-slate-100 rounded-md border border-slate-200">
          {current.results.map((order) => (
            <li key={order.orderNumber}>
              <button
                type="button"
                onClick={() => void choose(order.orderNumber)}
                disabled={loadingOrder !== null}
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-60"
              >
                <span className="font-medium text-slate-900">
                  {order.orderNumber} {loadingOrder === order.orderNumber && <Spinner label="" />}
                </span>
                <span className="text-xs text-slate-500">
                  {order.customer.name} · {order.customer.email} · {formatDate(order.placedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
