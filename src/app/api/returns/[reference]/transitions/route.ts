import { transitionShapeSchema } from "@/lib/validation";
import { readJson, methodNotAllowed, withErrorHandling } from "@/server/http";
import { transitionReturn } from "@/server/returns-service";

type Ctx = RouteContext<"/api/returns/[reference]/transitions">;

/**
 * POST /api/returns/:reference/transitions  { "to": "approved", "resolution": "refund", "refundAmount": 25 }
 * A status change is its own action rather than a PATCHable field: it has its own rules and payload.
 */
export const POST = withErrorHandling<Ctx>(async (request, ctx) => {
  const { reference } = await ctx.params;
  const input = await readJson(request, transitionShapeSchema);
  return Response.json({ data: await transitionReturn(reference.toUpperCase(), input) });
});

const notAllowed = methodNotAllowed("POST");
export { notAllowed as GET, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
