import { createReturnSchema, listReturnsQuerySchema } from "@/lib/validation";
import { parseQuery, readJson, withErrorHandling } from "@/server/http";
import { createReturn, listReturns } from "@/server/returns-service";

/** GET /api/returns?q=&status=&reason=&sort=&dir=&page=&pageSize= */
export const GET = withErrorHandling(async (request) => {
  const query = parseQuery(request, listReturnsQuerySchema);
  return Response.json(await listReturns(query));
});

/** POST /api/returns — raise a new return request. */
export const POST = withErrorHandling(async (request) => {
  const input = await readJson(request, createReturnSchema);
  const created = await createReturn(input);
  return Response.json(
    { data: created },
    { status: 201, headers: { Location: `/api/returns/${created.reference}` } },
  );
});
