"use client";

import { Check, FileWarning, Minus, PackageX, Plus, Ruler, Shuffle, Undo2, type LucideIcon } from "lucide-react";
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

export const REASON_META: Record<ReturnReason, { icon: LucideIcon; hint: string }> = {
  damaged: { icon: PackageX, hint: "Arrived broken or faulty" },
  wrong_item: { icon: Shuffle, hint: "Not what was ordered" },
  size_issue: { icon: Ruler, hint: "Doesn't fit" },
  not_as_described: { icon: FileWarning, hint: "Differs from the listing" },
  changed_mind: { icon: Undo2, hint: "No longer wanted" },
};

type Errors = Record<string, string>;

const optionCard =
  "relative flex cursor-pointer gap-3 rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-left transition-colors duration-150 " +
  "hover:bg-surface-2 has-[:checked]:border-accent has-[:checked]:bg-accent-soft " +
  "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-accent/15";

function CheckDot({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border transition-colors ${on ? "border-accent bg-accent text-accent-fg" : "border-line-strong bg-surface"}`}
    >
      {on && <Check className="size-2.5" strokeWidth={3.5} />}
    </span>
  );
}

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
      <legend className="sr-only">Item being returned</legend>
      <div className="grid gap-1.5">
        {order.items.map((item) => {
          const blockedBy = item.liveReturnReference && item.liveReturnReference !== currentReference ? item.liveReturnReference : null;
          const selected = value === item.sku;
          return (
            <label key={item.sku} className={`${optionCard} ${blockedBy ? "pointer-events-none opacity-55" : ""}`}>
              <input
                type="radio"
                name="sku"
                value={item.sku}
                checked={selected}
                disabled={Boolean(blockedBy)}
                onChange={() => onChange(item.sku)}
                className="sr-only"
              />
              <CheckDot on={selected} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">{item.productName}</span>
                <span className="mt-0.5 block text-xs text-muted">
                  <span className="font-mono">{item.sku}</span> · {item.quantity} ordered · {formatMoney(item.unitPrice)} each
                </span>
                {blockedBy && (
                  <span className="mt-1 inline-flex rounded bg-review-bg px-1.5 py-0.5 text-[11px] font-medium text-review-fg">
                    Already has a live return · {blockedBy}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id="sku-error" className="text-xs text-danger-text">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function QuantityField({
  value,
  onChange,
  error,
  max,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  max?: number;
}) {
  const n = Number(value) || 0;
  const step = (delta: number) => onChange(String(Math.max(1, Math.min(max ?? 999, n + delta))));
  const stepButton =
    "grid size-9 shrink-0 place-items-center rounded-lg border border-line-strong bg-surface text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-40";
  return (
    <Field label="Units returned" htmlFor="quantity" error={error} hint={max ? `Up to ${max} (the quantity ordered)` : undefined}>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Decrease quantity" className={stepButton} onClick={() => step(-1)} disabled={n <= 1}>
          <Minus className="size-4" />
        </button>
        <input
          {...describedBy("quantity", error)}
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass.replace("w-full", "w-20")} text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`}
        />
        <button type="button" aria-label="Increase quantity" className={stepButton} onClick={() => step(1)} disabled={max !== undefined && n >= max}>
          <Plus className="size-4" />
        </button>
      </div>
    </Field>
  );
}

export function ReasonPicker({
  value,
  onChange,
  error,
  hideLegend = false,
}: {
  value: ReturnReason | "";
  onChange: (reason: ReturnReason) => void;
  error?: string;
  /** When the surrounding section already says "Reason". */
  hideLegend?: boolean;
}) {
  return (
    <fieldset aria-describedby={error ? "reason-error" : undefined}>
      <legend className={hideLegend ? "sr-only" : "mb-1.5 text-[13px] font-medium text-ink-2"}>Reason</legend>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {RETURN_REASONS.map((reason) => {
          const Icon = REASON_META[reason].icon;
          const selected = value === reason;
          return (
            <label key={reason} className={`${optionCard} items-center`}>
              <input type="radio" name="reason" value={reason} checked={selected} onChange={() => onChange(reason)} className="sr-only" />
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-md transition-colors ${
                  selected ? "bg-surface text-accent-text" : "bg-surface-3 text-ink-2"
                }`}
              >
                <Icon aria-hidden className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">{REASON_LABELS[reason]}</span>
                <span className="block text-xs text-muted">{REASON_META[reason].hint}</span>
              </span>
              <CheckDot on={selected} />
            </label>
          );
        })}
      </div>
      {error && (
        <p id="reason-error" className="mt-1.5 text-xs text-danger-text">
          {error}
        </p>
      )}
    </fieldset>
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
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Customer name" htmlFor="customer-name" error={errors["customer.name"]}>
          <input
            {...describedBy("customer-name", errors["customer.name"])}
            autoComplete="off"
            value={values.name}
            onChange={(e) => set({ name: e.target.value })}
            className={inputClass}
          />
        </Field>
      </div>
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
          placeholder="+91 98765 43210"
          className={inputClass}
        />
      </Field>
    </div>
  );
}
