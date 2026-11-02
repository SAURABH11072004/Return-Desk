import { searchOrdersQuerySchema } from "@/lib/validation";
import { parseQuery, methodNotAllowed, withErrorHandling } from "@/server/http";
import { searchOrders } from "@/server/orders-service";

/** GET /api/orders?q= — find an order by number or customer when raising a request. */
export const GET = withErrorHandling(async (request) => {
  const { q } = parseQuery(request, searchOrdersQuerySchema);
  return Response.json({ data: await searchOrders(q) });
});

const notAllowed = methodNotAllowed("GET");
export { notAllowed as POST, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
