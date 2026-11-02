import { z } from "zod";
import { toFieldIssues } from "@/lib/validation";
import { ApiError, badRequest, conflict, validationFailed } from "@/server/errors";

/** Parse and validate a JSON body. Malformed JSON is a 400; a rule violation is a 422. */
export async function readJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.output<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw badRequest("INVALID_JSON", "Request body must be valid JSON");
  }
  const result = schema.safeParse(body);
  if (!result.success) throw validationFailed(toFieldIssues(result.error));
  return result.data;
}

export function parseQuery<S extends z.ZodType>(request: Request, schema: S): z.output<S> {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const result = schema.safeParse(params);
  if (!result.success) {
    throw badRequest("INVALID_QUERY", "Some query parameters are invalid", toFieldIssues(result.error));
  }
  return result.data;
}

/** Postgres errors arrive either directly or wrapped (Drizzle sets the driver error as `cause`). */
function postgresError(error: unknown): { code?: string; constraint_name?: string } | undefined {
  let current: unknown = error;
  for (let depth = 0; current && depth < 3; depth++) {
    if (typeof current === "object" && "code" in current && "severity" in current) {
      return current as { code?: string; constraint_name?: string };
    }
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/**
 * The service layer checks every rule before writing. If a concurrent request slips between
 * that check and the write, the database constraint fires instead; translate it so the client
 * still gets the honest 409 rather than a 500.
 */
function fromDatabaseError(error: unknown): ApiError | undefined {
  const pg = postgresError(error);
  if (pg?.code === "23505" && pg.constraint_name === "return_requests_one_live_per_order_item") {
    return conflict(
      "DUPLICATE_LIVE_REQUEST",
      "This order item already has a live return request. Close it out (Rejected or Completed) before raising another.",
    );
  }
  return undefined;
}

export function errorResponse(error: unknown): Response {
  const apiError = error instanceof ApiError ? error : fromDatabaseError(error);
  if (apiError) {
    return Response.json(
      { error: { code: apiError.code, message: apiError.message, ...(apiError.details && { details: apiError.details }) } },
      { status: apiError.status },
    );
  }
  console.error("Unhandled API error", error);
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong on our side. Please try again." } },
    { status: 500 },
  );
}

/** Wraps a route handler so every failure leaves as a JSON error body with a fitting status. */
export function withErrorHandling<Ctx>(handler: (request: Request, ctx: Ctx) => Promise<Response>) {
  return async (request: Request, ctx: Ctx): Promise<Response> => {
    try {
      return await handler(request, ctx);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
