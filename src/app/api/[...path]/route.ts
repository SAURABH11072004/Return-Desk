/** Unknown /api/* paths get the same JSON error shape instead of Next's HTML 404 page. */
const notFound = () =>
  Response.json({ error: { code: "NOT_FOUND", message: "No such API endpoint" } }, { status: 404 });

export { notFound as GET, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE };
