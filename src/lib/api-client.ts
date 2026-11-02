/**
 * Browser-side wrapper around fetch for our API. Any non-2xx response becomes an ApiRequestError
 * carrying the server's code and message, so the UI can always tell the agent why.
 */
import type { ApiErrorBody } from "@/lib/api-types";
import type { FieldIssue } from "@/lib/validation";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly issues: FieldIssue[] = [],
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiFetch<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  let response: Response;
  try {
    response = await fetch(path, {
      ...rest,
      headers: json === undefined ? rest.headers : { "content-type": "application/json", ...rest.headers },
      body: json === undefined ? rest.body : JSON.stringify(json),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiRequestError(0, "NETWORK_ERROR", "Could not reach the server. Check your connection and try again.");
  }

  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as ApiErrorBody | null)?.error;
    throw new ApiRequestError(
      response.status,
      error?.code ?? "UNKNOWN_ERROR",
      error?.message ?? `The server responded with ${response.status}.`,
      error?.details?.issues ?? [],
    );
  }
  return body as T;
}

export const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

/** Map field issues to { "customer.email": "message" } for showing next to inputs. */
export function fieldErrors(issues: FieldIssue[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of issues) map[issue.path] ??= issue.message;
  return map;
}
