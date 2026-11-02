"use client";

import { describedBy, Field, inputClass } from "@/components/field";
import type { OrderDetail } from "@/lib/api-types";
import { REASON_LABELS, RETURN_REASONS, type ReturnReason } from "@/lib/domain";
import { formatMoney } from "@/lib/format";

/** Form state for the parts of a request an agent fills in (create) or corrects (edit). */
export type RequestFormValues = {
  sku: string;
  quantity: string;
  reason: ReturnReason | "";
  customer: { name: string; email: string; phone: string };
};

/** Convert form state into the API payload; the shared Zod schema then validates it. */
export function toPayload(values: RequestFormValues) {
  return {
    sku: values.sku,
    quantity: values.quantity.trim() === "" ? Number.NaN : Number(values.quantity),
    reason: values.reason || undefined,
    customer: {
      name: values.customer.name,
      email: values.customer.email,
      phone: values.customer.phone.trim() === "" ? null : values.customer.phone,
    },
  };
}

type Errors = Record<string, string>;

export function ItemPicker({
  order,
  value,
  onChange,
  error,
  currentReference,
}: {
  order: OrderDetail;
  value: string;
  onChange: (sku: string) => void;
  error?: string;
  /** When editing, the request's own live return should not block its own item. */
  currentReference?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? "sku-error" : undefined}>
      <legend className="text-sm font-medium text-slate-700">Item being returned</legend>
      <ul className="flex flex-col gap-2">
        {order.items.map((item) => {
          const blockedBy = item.liveReturnReference && item.liveReturnReference !== currentReference ? item.liveReturnReference : null;
          return (
            <li key={item.sku}>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 ${
                  blockedBy ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-70" : "border-slate-200 bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="sku"
                  value={item.sku}
                  checked={value === item.sku}
                  disabled={Boolean(blockedBy)}
                  onChange={() => onChange(item.sku)}
                  className="mt-0.5"
                />
                <span className="flex-1">
                  <span className="block font-medium text-slate-900">{item.productName}</span>
                  <span className="block text-xs text-slate-500">
                    {item.sku} · {item.quantity} ordered · {formatMoney(item.unitPrice)} each
                  </span>
                  {blockedBy && (
                    <span className="mt-1 block text-xs text-amber-800">Already has a live return ({blockedBy})</span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {error && (
        <p id="sku-error" className="text-xs text-rose-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function QuantityAndReasonFields({
  values,
  onChange,
  errors,
  maxQuantity,
}: {
  values: RequestFormValues;
  onChange: (patch: Partial<RequestFormValues>) => void;
  errors: Errors;
  maxQuantity?: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Quantity" htmlFor="quantity" error={errors.quantity} hint={maxQuantity ? `Up to ${maxQuantity}` : undefined}>
        <input
          {...describedBy("quantity", errors.quantity)}
          type="number"
          inputMode="numeric"
          min={1}
          max={maxQuantity}
          value={values.quantity}
          onChange={(e) => onChange({ quantity: e.target.value })}
          className={inputClass}
        />
      </Field>
      <Field label="Reason" htmlFor="reason" error={errors.reason}>
        <select
          {...describedBy("reason", errors.reason)}
          value={values.reason}
          onChange={(e) => onChange({ reason: e.target.value as ReturnReason | "" })}
          className={inputClass}
        >
          <option value="">Choose a reason</option>
          {RETURN_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {REASON_LABELS[reason]}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

export function CustomerFields({
  values,
  onChange,
  errors,
}: {
  values: RequestFormValues["customer"];
  onChange: (customer: RequestFormValues["customer"]) => void;
  errors: Errors;
}) {
  const set = (patch: Partial<RequestFormValues["customer"]>) => onChange({ ...values, ...patch });
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-2 text-sm font-medium text-slate-700">How to reach the customer</legend>
      <Field label="Name" htmlFor="customer-name" error={errors["customer.name"]}>
        <input
          {...describedBy("customer-name", errors["customer.name"])}
          autoComplete="off"
          value={values.name}
          onChange={(e) => set({ name: e.target.value })}
          className={inputClass}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" htmlFor="customer-email" error={errors["customer.email"]}>
          <input
            {...describedBy("customer-email", errors["customer.email"])}
            type="email"
            autoComplete="off"
            value={values.email}
            onChange={(e) => set({ email: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Phone (optional)" htmlFor="customer-phone" error={errors["customer.phone"]}>
          <input
            {...describedBy("customer-phone", errors["customer.phone"])}
            type="tel"
            autoComplete="off"
            value={values.phone}
            onChange={(e) => set({ phone: e.target.value })}
            className={inputClass}
          />
        </Field>
      </div>
    </fieldset>
  );
}
