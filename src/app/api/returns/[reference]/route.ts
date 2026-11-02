import { updateReturnSchema } from "@/lib/validation";
import { readJson, methodNotAllowed, withErrorHandling } from "@/server/http";
import { getReturn, removeReturn, updateReturn } from "@/server/returns-service";

type Ctx = RouteContext<"/api/returns/[reference]">;

/** GET /api/returns/:reference — the request with its notes and status history. */
export const GET = withErrorHandling<Ctx>(async (_request, ctx) => {
  const { reference } = await ctx.params;
  return Response.json({ data: await getReturn(reference.toUpperCase()) });
});

/** PATCH /api/returns/:reference — correct customer/item details while still undecided. */
export const PATCH = withErrorHandling<Ctx>(async (request, ctx) => {
  const { reference } = await ctx.params;
  const input = await readJson(request, updateReturnSchema);
  return Response.json({ data: await updateReturn(reference.toUpperCase(), input) });
});

/** DELETE /api/returns/:reference — take an Open or Rejected request off the desk (soft delete). */
export const DELETE = withErrorHandling<Ctx>(async (_request, ctx) => {
  const { reference } = await ctx.params;
  await removeReturn(reference.toUpperCase());
  return new Response(null, { status: 204 });
});

const notAllowed = methodNotAllowed("GET", "PATCH", "DELETE");
export { notAllowed as PUT, notAllowed as POST };
