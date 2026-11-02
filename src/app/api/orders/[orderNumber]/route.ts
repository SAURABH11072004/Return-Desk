import { methodNotAllowed, withErrorHandling } from "@/server/http";
import { getOrder } from "@/server/orders-service";

type Ctx = RouteContext<"/api/orders/[orderNumber]">;

/** GET /api/orders/:orderNumber — the order, its customer and items (with any live return per item). */
export const GET = withErrorHandling<Ctx>(async (_request, ctx) => {
  const { orderNumber } = await ctx.params;
  return Response.json({ data: await getOrder(orderNumber.toUpperCase()) });
});

const notAllowed = methodNotAllowed("GET");
export { notAllowed as POST, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
