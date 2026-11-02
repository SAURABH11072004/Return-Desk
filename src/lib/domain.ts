/**
 * The ReturnDesk domain vocabulary and lifecycle rules.
 *
 * This module is pure (no I/O) so it is shared by the database schema (enum values),
 * the API (rule enforcement) and the UI (labels). The UI never re-derives which actions
 * are legal: the API computes `allowedActions` with the functions below and returns them.
 */

export const RETURN_STATUSES = ["open", "in_review", "approved", "rejected", "completed"] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export const RETURN_REASONS = [
  "damaged",
  "wrong_item",
  "size_issue",
  "not_as_described",
  "changed_mind",
] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number];

export const RESOLUTIONS = ["refund", "replacement", "store_credit"] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

export const STATUS_LABELS: Record<ReturnStatus, string> = {
  open: "Open",
  in_review: "In Review",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
};

export const REASON_LABELS: Record<ReturnReason, string> = {
  damaged: "Damaged",
  wrong_item: "Wrong Item",
  size_issue: "Size Issue",
  not_as_described: "Not As Described",
  changed_mind: "Changed Mind",
};

export const RESOLUTION_LABELS: Record<Resolution, string> = {
  refund: "Refund",
  replacement: "Replacement",
  store_credit: "Store Credit",
};

/** Rule 1: the only legal moves. Rejected and Completed are final. */
export const TRANSITIONS: Record<ReturnStatus, readonly ReturnStatus[]> = {
  open: ["in_review"],
  in_review: ["approved", "rejected"],
  approved: ["completed"],
  rejected: [],
  completed: [],
};

/** Rule 3: a request in one of these states blocks a new request for the same order item. */
export const LIVE_STATUSES: readonly ReturnStatus[] = ["open", "in_review", "approved"];

/** Rule 4: customer and item details may only be corrected before a decision. */
export const EDITABLE_STATUSES: readonly ReturnStatus[] = ["open", "in_review"];

/** Rule 5: only these may be taken off the desk. */
export const REMOVABLE_STATUSES: readonly ReturnStatus[] = ["open", "rejected"];

export function canTransition(from: ReturnStatus, to: ReturnStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isEditable(status: ReturnStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

export function isRemovable(status: ReturnStatus): boolean {
  return REMOVABLE_STATUSES.includes(status);
}

export type AllowedActions = {
  transitions: ReturnStatus[];
  canEdit: boolean;
  canRemove: boolean;
  canAddNote: true;
};

export function allowedActions(status: ReturnStatus): AllowedActions {
  return {
    transitions: [...TRANSITIONS[status]],
    canEdit: isEditable(status),
    canRemove: isRemovable(status),
    canAddNote: true,
  };
}
