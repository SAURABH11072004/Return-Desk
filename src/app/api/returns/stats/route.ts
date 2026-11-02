import { methodNotAllowed, withErrorHandling } from "@/server/http";
import { getReturnStats } from "@/server/returns-service";

/** GET /api/returns/stats — desk-wide counts per status, plus 7-day raised/closed activity. */
export const GET = withErrorHandling(async () => Response.json({ data: await getReturnStats() }));

const notAllowed = methodNotAllowed("GET");
export { notAllowed as POST, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
