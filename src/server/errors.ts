import type { FieldIssue } from "@/lib/validation";

/**
 * Every error the API returns has this body:
 *   { "error": { "code": "INVALID_TRANSITION", "message": "...", "details": { ... } } }
 * `code` is stable and machine-readable; `message` is safe to show to an agent.
 */
export type ErrorCode =
  | "INVALID_JSON"
  | "INVALID_QUERY"
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "ORDER_ITEM_NOT_FOUND"
  | "QUANTITY_EXCEEDS_ORDERED"
  | "REFUND_EXCEEDS_ITEM_VALUE"
  | "INVALID_TRANSITION"
  | "DUPLICATE_LIVE_REQUEST"
  | "REQUEST_LOCKED"
  | "REMOVAL_NOT_ALLOWED"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** 400: the request itself could not be understood (bad JSON, bad query string). */
export const badRequest = (code: "INVALID_JSON" | "INVALID_QUERY", message: string, issues?: FieldIssue[]) =>
  new ApiError(400, code, message, issues ? { issues } : undefined);

/** 422: well-formed, but the content breaks a validation rule. */
export const validationFailed = (issues: FieldIssue[]) =>
  new ApiError(
    422,
    "VALIDATION_FAILED",
    issues.length === 1 ? issues[0].message : `${issues.length} fields are invalid`,
    { issues },
  );

export const unprocessable = (
  code: "ORDER_ITEM_NOT_FOUND" | "QUANTITY_EXCEEDS_ORDERED" | "REFUND_EXCEEDS_ITEM_VALUE",
  message: string,
  details?: Record<string, unknown>,
) => new ApiError(422, code, message, details);

export const notFound = (message: string) => new ApiError(404, "NOT_FOUND", message);

/** 409: the request is valid, but the resource's current state forbids it. */
export const conflict = (
  code: "INVALID_TRANSITION" | "DUPLICATE_LIVE_REQUEST" | "REQUEST_LOCKED" | "REMOVAL_NOT_ALLOWED",
  message: string,
  details?: Record<string, unknown>,
) => new ApiError(409, code, message, details);
