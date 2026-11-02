/**
 * Shapes the API returns. Shared with the UI so both sides agree on the contract.
 * Money is a decimal string ("49.99") so no precision is lost in transit; timestamps are ISO-8601.
 */
import type { AllowedActions, Resolution, ReturnReason, ReturnStatus } from "@/lib/domain";
import type { FieldIssue } from "@/lib/validation";

export type CustomerContact = { name: string; email: string; phone: string | null };

export type ReturnSummary = {
  reference: string;
  status: ReturnStatus;
  reason: ReturnReason;
  quantity: number;
  customer: CustomerContact;
  order: { orderNumber: string; placedAt: string };
  item: { sku: string; productName: string; unitPrice: string; orderedQuantity: number };
  resolution: Resolution | null;
  refundAmount: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReturnNote = { id: number; author: string; body: string; createdAt: string };

export type StatusChange = { from: ReturnStatus; to: ReturnStatus; changedAt: string };

export type ReturnDetail = ReturnSummary & {
  allowedActions: AllowedActions;
  notes: ReturnNote[];
  statusHistory: StatusChange[];
};

/** Desk-wide counts for the dashboard. Removed requests are excluded. */
export type ReturnStats = {
  total: number;
  byStatus: Record<ReturnStatus, number>;
  /** Requests raised in the last 7 days. */
  raisedLast7Days: number;
  /** Requests that reached Rejected or Completed in the last 7 days. */
  closedLast7Days: number;
};

export type PageMeta = { page: number; pageSize: number; total: number; totalPages: number };

export type OrderSummary = {
  orderNumber: string;
  placedAt: string;
  customer: CustomerContact;
};

export type OrderDetail = OrderSummary & {
  items: {
    sku: string;
    productName: string;
    unitPrice: string;
    quantity: number;
    /** Reference of the live (open / in review / approved) return on this item, if any. */
    liveReturnReference: string | null;
  }[];
};

export type ApiErrorBody = {
  error: { code: string; message: string; details?: { issues?: FieldIssue[]; [key: string]: unknown } };
};
