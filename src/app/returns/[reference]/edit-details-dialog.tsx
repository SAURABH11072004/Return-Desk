"use client";

import { useEffect, useState } from "react";
import { ErrorAlert } from "@/components/alert";
import { DialogButtons } from "@/components/dialog-buttons";
import { Spinner } from "@/components/spinner";
import { apiFetch, ApiRequestError, errorMessage, fieldErrors, isAbort } from "@/lib/api-client";
import type { OrderDetail, ReturnDetail } from "@/lib/api-types";
import { toFieldIssues, updateReturnSchema } from "@/lib/validation";
import {
  CustomerFields,
  ItemPicker,
  QuantityAndReasonFields,
  toPayload,
  type RequestFormValues,
} from "../_components/request-fields";

/** Correct customer and item details. Only offered while the request is undecided (rule 4). */
export function EditDetailsDialog({
  detail,
  path,
  onDone,
  onCancel,
  onStale,
}: {
  detail: ReturnDetail;
  path: string;
  onDone: (detail: ReturnDetail) => void;
  onCancel: () => void;
  onStale: () => void;
}) {
  const [values, setValues] = useState<RequestFormValues>({
    sku: detail.item.sku,
    quantity: String(detail.quantity),
    reason: detail.reason,
    customer: { name: detail.customer.name, email: detail.customer.email, phone: detail.customer.phone ?? "" },
  });
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // The item can be corrected to another item on the same order, so load the order's items.
  useEffect(() => {
    const controller = new AbortController();
    apiFetch<{ data: OrderDetail }>(`/api/orders/${encodeURIComponent(detail.order.orderNumber)}`, { signal: controller.signal })
      .then(({ data }) => setOrder(data))
      .catch((err) => {
        if (!isAbort(err)) setOrderError(errorMessage(err));
      });
    return () => controller.abort();
  }, [detail.order.orderNumber]);

  const update = (patch: Partial<RequestFormValues>) => setValues((v) => ({ ...v, ...patch }));
  const selectedItem = order?.items.find((item) => item.sku === values.sku);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const check = updateReturnSchema.safeParse(toPayload(values));
    if (!check.success) {
      setErrors(fieldErrors(toFieldIssues(check.error)));
      return;
    }
    setPending(true);
    setErrors({});
    setFormError(null);
    try {
      const { data } = await apiFetch<{ data: ReturnDetail }>(path, { method: "PATCH", json: check.data });
      onDone(data);
    } catch (err) {
      setFormError(errorMessage(err));
      if (err instanceof ApiRequestError) {
        setErrors(fieldErrors(err.issues));
        if (err.status === 409 || err.status === 404) onStale();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
      {orderError ? (
        <ErrorAlert title="Could not load the order's items" message={orderError} />
      ) : order ? (
        <ItemPicker order={order} value={values.sku} onChange={(sku) => update({ sku })} error={errors.sku} currentReference={detail.reference} />
      ) : (
        <Spinner label="Loading order items" />
      )}
      <QuantityAndReasonFields values={values} onChange={update} errors={errors} maxQuantity={selectedItem?.quantity} />
      <CustomerFields values={values.customer} onChange={(customer) => update({ customer })} errors={errors} />
      {formError && <ErrorAlert message={formError} />}
      <DialogButtons pending={pending} onCancel={onCancel} confirmLabel="Save changes" submit />
    </form>
  );
}
