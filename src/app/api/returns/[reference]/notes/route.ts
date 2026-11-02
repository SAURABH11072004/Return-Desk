import { createNoteSchema } from "@/lib/validation";
import { readJson, withErrorHandling } from "@/server/http";
import { addNote, listNotes } from "@/server/returns-service";

type Ctx = RouteContext<"/api/returns/[reference]/notes">;

/** GET /api/returns/:reference/notes — oldest first. */
export const GET = withErrorHandling<Ctx>(async (_request, ctx) => {
  const { reference } = await ctx.params;
  return Response.json({ data: await listNotes(reference.toUpperCase()) });
});

/** POST /api/returns/:reference/notes — notes are append-only; there is no PATCH or DELETE. */
export const POST = withErrorHandling<Ctx>(async (request, ctx) => {
  const { reference } = await ctx.params;
  const input = await readJson(request, createNoteSchema);
  return Response.json({ data: await addNote(reference.toUpperCase(), input) }, { status: 201 });
});
