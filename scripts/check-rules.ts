/**
 * Black-box check of every business rule against a RUNNING ReturnDesk, over plain HTTP — the way
 * a reviewer with curl or Postman would test it. It creates its own requests on order items that
 * have no live return, so it works against a freshly seeded database (local or deployed).
 *
 * Usage:  npm run check:rules                      (defaults to http://localhost:3000)
 *         BASE_URL=https://your-app.vercel.app npm run check:rules
 *
 * Note: it writes data (creates, moves and removes requests) and reports each check as PASS/FAIL.
 */
const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

type Res = { status: number; body: any; headers: Headers }; // eslint-disable-line @typescript-eslint/no-explicit-any

async function call(method: string, path: string, body?: unknown): Promise<Res> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { nonJson: text.slice(0, 80) };
  }
  return { status: response.status, body: parsed, headers: response.headers };
}

let passed = 0;
const failures: string[] = [];

function check(name: string, res: Res, status: number, code?: string, extra?: (r: Res) => boolean) {
  const ok =
    res.status === status &&
    (code === undefined || res.body?.error?.code === code) &&
    (status < 400 || typeof res.body?.error?.message === "string") &&
    (extra === undefined || extra(res));
  const got = `${res.status}${res.body?.error?.code ? ` ${res.body.error.code}` : ""}`;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(74)} → ${got}`);
  if (ok) passed++;
  else failures.push(`${name}: expected ${status}${code ? ` ${code}` : ""}, got ${got} ${JSON.stringify(res.body)}`);
}

function section(title: string) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 76 - title.length))}`);
}

type FreeItem = { orderNumber: string; sku: string; quantity: number; unitPrice: string; customer: { name: string; email: string } };

/** Order items with no live return, found through the public API. */
async function findFreeItems(needed: number): Promise<FreeItem[]> {
  const free: FreeItem[] = [];
  for (let n = 10036; n >= 10001 && free.length < needed; n--) {
    const res = await call("GET", `/api/orders/ORD-${n}`);
    if (res.status !== 200) continue;
    const order = res.body.data;
    for (const item of order.items) {
      if (!item.liveReturnReference) {
        free.push({ orderNumber: order.orderNumber, sku: item.sku, quantity: item.quantity, unitPrice: item.unitPrice, customer: order.customer });
      }
    }
  }
  if (free.length < needed) throw new Error(`Need ${needed} order items without a live return, found ${free.length}. Re-seed the database.`);
  return free.slice(0, needed);
}

const payload = (item: FreeItem, overrides: Record<string, unknown> = {}) => ({
  orderNumber: item.orderNumber,
  sku: item.sku,
  quantity: 1,
  reason: "damaged",
  customer: { name: item.customer.name, email: item.customer.email, phone: null },
  ...overrides,
});

async function create(item: FreeItem): Promise<string> {
  const res = await call("POST", "/api/returns", payload(item));
  if (res.status !== 201) throw new Error(`Setup create failed: ${JSON.stringify(res.body)}`);
  return res.body.data.reference;
}

const move = (ref: string, body: unknown) => call("POST", `/api/returns/${ref}/transitions`, body);

async function main() {
  console.log(`Checking ReturnDesk at ${BASE_URL}`);
  const items = await findFreeItems(9);

  // ---------------------------------------------------------------------------------------------
  section("Raising a request");
  const created = await call("POST", "/api/returns", payload(items[0]));
  check("valid request is created with a generated reference", created, 201, undefined, (r) =>
    /^RD-\d{6}$/.test(r.body.data.reference) && r.body.data.status === "open" && r.headers.get("location") === `/api/returns/${r.body.data.reference}`);
  const a: string = created.body.data.reference;
  check("client cannot supply its own reference", await call("POST", "/api/returns", payload(items[1], { reference: "MINE-1" })), 422, "VALIDATION_FAILED");
  check("malformed JSON body", await call("POST", "/api/returns", "{oops"), 400, "INVALID_JSON");
  check("missing / invalid fields are listed", await call("POST", "/api/returns", { quantity: 0, reason: "bored" }), 422, "VALIDATION_FAILED",
    (r) => r.body.error.details.issues.length >= 4);
  check("reason must be one of the five", await call("POST", "/api/returns", payload(items[1], { reason: "too_expensive" })), 422, "VALIDATION_FAILED");
  check("invalid customer email", await call("POST", "/api/returns", payload(items[1], { customer: { name: "X", email: "not-an-email" } })), 422, "VALIDATION_FAILED");
  check("item that is not on the order", await call("POST", "/api/returns", payload(items[1], { sku: "NO-SUCH-SKU" })), 422, "ORDER_ITEM_NOT_FOUND");
  check("more units than were ordered", await call("POST", "/api/returns", payload(items[1], { quantity: items[1].quantity + 1 })), 422, "QUANTITY_EXCEEDS_ORDERED");

  // ---------------------------------------------------------------------------------------------
  section("Rule 1 — status flow (Open → In Review → Approved/Rejected; Approved → Completed)");
  check("Open → Completed is refused", await move(a, { to: "completed" }), 409, "INVALID_TRANSITION",
    (r) => JSON.stringify(r.body.error.details.allowed) === '["in_review"]');
  check("Open → Approved is refused", await move(a, { to: "approved", resolution: "replacement" }), 409, "INVALID_TRANSITION");
  check("Open → Rejected is refused", await move(a, { to: "rejected" }), 409, "INVALID_TRANSITION");
  check("Open → Open is refused", await move(a, { to: "open" }), 409, "INVALID_TRANSITION");
  check("unknown target status", await move(a, { to: "closed" }), 422, "VALIDATION_FAILED");
  check("Open → In Review", await move(a, { to: "in_review" }), 200, undefined, (r) => r.body.data.status === "in_review");
  check("In Review → Completed is refused", await move(a, { to: "completed" }), 409, "INVALID_TRANSITION");
  check("In Review → Open is refused (no going back)", await move(a, { to: "open" }), 409, "INVALID_TRANSITION");

  const rej = await create(items[2]);
  await move(rej, { to: "in_review" });
  check("In Review → Rejected", await move(rej, { to: "rejected" }), 200);
  check("Rejected is final: → In Review refused", await move(rej, { to: "in_review" }), 409, "INVALID_TRANSITION");
  check("Rejected is final: → Approved refused", await move(rej, { to: "approved", resolution: "replacement" }), 409, "INVALID_TRANSITION");

  // ---------------------------------------------------------------------------------------------
  section("Rule 2 — approval needs a resolution");
  check("approve without a resolution", await move(a, { to: "approved" }), 422, "VALIDATION_FAILED",
    (r) => r.body.error.details.issues[0].path === "resolution");
  check("refund without an amount", await move(a, { to: "approved", resolution: "refund" }), 422, "VALIDATION_FAILED");
  check("refund of 0", await move(a, { to: "approved", resolution: "refund", refundAmount: 0 }), 422, "VALIDATION_FAILED");
  check("negative refund", await move(a, { to: "approved", resolution: "refund", refundAmount: -10 }), 422, "VALIDATION_FAILED");
  check("refund with more than 2 decimals", await move(a, { to: "approved", resolution: "refund", refundAmount: 1.234 }), 422, "VALIDATION_FAILED");
  check("refund amount sent with Replacement", await move(a, { to: "approved", resolution: "replacement", refundAmount: 10 }), 422, "VALIDATION_FAILED");
  check("refund amount sent with Store Credit", await move(a, { to: "approved", resolution: "store_credit", refundAmount: 10 }), 422, "VALIDATION_FAILED");
  check("unknown resolution", await move(a, { to: "approved", resolution: "voucher" }), 422, "VALIDATION_FAILED");
  check("refund larger than what was paid", await move(a, { to: "approved", resolution: "refund", refundAmount: Number(items[0].unitPrice) + 1 }), 422, "REFUND_EXCEEDS_ITEM_VALUE");
  check("approve with a valid refund", await move(a, { to: "approved", resolution: "refund", refundAmount: 10.5 }), 200, undefined,
    (r) => r.body.data.resolution === "refund" && r.body.data.refundAmount === "10.50");
  const sc = await create(items[3]);
  await move(sc, { to: "in_review" });
  check("resolution sent on a non-approve move (In Review → Rejected)", await move(sc, { to: "rejected", resolution: "refund", refundAmount: 5 }), 422, "VALIDATION_FAILED");
  check("approve with Store Credit (no amount)", await move(sc, { to: "approved", resolution: "store_credit" }), 200, undefined,
    (r) => r.body.data.refundAmount === null);
  check("Approved → Completed", await move(a, { to: "completed" }), 200);
  check("Completed is final: → Approved refused", await move(a, { to: "approved", resolution: "replacement" }), 409, "INVALID_TRANSITION");

  // ---------------------------------------------------------------------------------------------
  section("Rule 3 — one live request per item on an order");
  const live = await create(items[4]);
  check("second request while the first is Open", await call("POST", "/api/returns", payload(items[4])), 409, "DUPLICATE_LIVE_REQUEST",
    (r) => r.body.error.details.existingReference === live);
  await move(live, { to: "in_review" });
  check("second request while the first is In Review", await call("POST", "/api/returns", payload(items[4])), 409, "DUPLICATE_LIVE_REQUEST");
  await move(live, { to: "approved", resolution: "replacement" });
  check("second request while the first is Approved", await call("POST", "/api/returns", payload(items[4])), 409, "DUPLICATE_LIVE_REQUEST");
  await move(live, { to: "completed" });
  const again = await call("POST", "/api/returns", payload(items[4]));
  check("allowed again once the first is Completed", again, 201);
  check("allowed again once the first is Rejected", await call("POST", "/api/returns", payload(items[2])), 201);
  check("same item, different case in SKU/order number is still a duplicate",
    await call("POST", "/api/returns", payload(items[4], { sku: items[4].sku.toLowerCase(), orderNumber: items[4].orderNumber.toLowerCase() })), 409, "DUPLICATE_LIVE_REQUEST");
  const race = await Promise.all([call("POST", "/api/returns", payload(items[5])), call("POST", "/api/returns", payload(items[5]))]);
  const statuses = race.map((r) => r.status).sort().join(",");
  console.log(`${statuses === "201,409" ? "PASS" : "FAIL"}  ${"two simultaneous creates: exactly one wins".padEnd(74)} → ${statuses}`);
  if (statuses === "201,409") passed++;
  else failures.push(`race: expected 201,409 got ${statuses}`);

  // ---------------------------------------------------------------------------------------------
  section("Rule 4 — details locked once decided");
  const ed = await create(items[6]);
  check("edit while Open", await call("PATCH", `/api/returns/${ed}`, { quantity: 1, customer: { phone: "+91 90000 00000" } }), 200, undefined,
    (r) => r.body.data.customer.phone === "+91 90000 00000");
  await move(ed, { to: "in_review" });
  check("edit while In Review", await call("PATCH", `/api/returns/${ed}`, { reason: "wrong_item" }), 200, undefined, (r) => r.body.data.reason === "wrong_item");
  check("status cannot be changed through PATCH", await call("PATCH", `/api/returns/${ed}`, { status: "completed" }), 422, "VALIDATION_FAILED");
  check("empty PATCH body", await call("PATCH", `/api/returns/${ed}`, {}), 422, "VALIDATION_FAILED");
  check("edit Approved request", await call("PATCH", `/api/returns/${sc}`, { customer: { name: "Someone Else" } }), 409, "REQUEST_LOCKED");
  check("edit Rejected request", await call("PATCH", `/api/returns/${rej}`, { quantity: 1 }), 409, "REQUEST_LOCKED");
  check("edit Completed request", await call("PATCH", `/api/returns/${a}`, { reason: "changed_mind" }), 409, "REQUEST_LOCKED");
  check("note on a Completed request is still allowed", await call("POST", `/api/returns/${a}/notes`, { author: "Checker", body: "Closed out." }), 201);

  // ---------------------------------------------------------------------------------------------
  section("Rule 5 — removal (soft delete, Open or Rejected only)");
  check("remove In Review request", await call("DELETE", `/api/returns/${ed}`), 409, "REMOVAL_NOT_ALLOWED");
  check("remove Approved request", await call("DELETE", `/api/returns/${sc}`), 409, "REMOVAL_NOT_ALLOWED");
  check("remove Completed request", await call("DELETE", `/api/returns/${a}`), 409, "REMOVAL_NOT_ALLOWED");
  const gone = await create(items[7]);
  check("remove Open request", await call("DELETE", `/api/returns/${gone}`), 204);
  check("removed request can no longer be fetched", await call("GET", `/api/returns/${gone}`), 404, "NOT_FOUND");
  check("removed request cannot be edited", await call("PATCH", `/api/returns/${gone}`, { quantity: 1 }), 404, "NOT_FOUND");
  check("removed request cannot be moved", await call("POST", `/api/returns/${gone}/transitions`, { to: "in_review" }), 404, "NOT_FOUND");
  check("removing it again", await call("DELETE", `/api/returns/${gone}`), 404, "NOT_FOUND");
  check("removed request is not in the list", await call("GET", `/api/returns?q=${gone}`), 200, undefined, (r) => r.body.meta.total === 0);
  check("remove Rejected request", await call("DELETE", `/api/returns/${rej}`), 204);
  check("a removed Open request no longer blocks its item", await call("POST", "/api/returns", payload(items[7])), 201);

  // ---------------------------------------------------------------------------------------------
  section("Notes — append-only");
  const nr = await create(items[8]);
  await call("POST", `/api/returns/${nr}/notes`, { author: "Asha", body: "First" });
  await call("POST", `/api/returns/${nr}/notes`, { author: "Ben", body: "Second" });
  check("notes come back oldest first", await call("GET", `/api/returns/${nr}`), 200, undefined,
    (r) => r.body.data.notes.map((n: { body: string }) => n.body).join(",") === "First,Second");
  check("blank note is refused", await call("POST", `/api/returns/${nr}/notes`, { author: "Asha", body: "   " }), 422, "VALIDATION_FAILED");
  check("there is no way to edit notes (PATCH)", await call("PATCH", `/api/returns/${nr}/notes`, { body: "x" }), 405, "METHOD_NOT_ALLOWED",
    (r) => r.headers.get("allow") === "GET, POST");
  check("there is no way to delete notes (DELETE)", await call("DELETE", `/api/returns/${nr}/notes`), 405, "METHOD_NOT_ALLOWED");

  // ---------------------------------------------------------------------------------------------
  section("Finding requests — search, filter, sort, page (all server-side)");
  check("search by customer name", await call("GET", "/api/returns?q=priya"), 200, undefined, (r) => r.body.meta.total > 0 &&
    r.body.data.every((x: { customer: { name: string } }) => x.customer.name.toLowerCase().includes("priya")));
  check("search by order number", await call("GET", "/api/returns?q=ORD-10001"), 200, undefined, (r) => r.body.meta.total > 0);
  check("search by reference", await call("GET", "/api/returns?q=RD-000001"), 200, undefined, (r) => r.body.data[0]?.reference === "RD-000001");
  check("filter by several statuses + a reason", await call("GET", "/api/returns?status=open,in_review&reason=damaged"), 200, undefined,
    (r) => r.body.data.every((x: { status: string; reason: string }) => ["open", "in_review"].includes(x.status) && x.reason === "damaged"));
  check("sort by customer A–Z", await call("GET", "/api/returns?sort=customerName&dir=asc&pageSize=50"), 200, undefined, (r) => {
    const names = r.body.data.map((x: { customer: { name: string } }) => x.customer.name.toLowerCase());
    return names.every((n: string, i: number) => i === 0 || names[i - 1] <= n);
  });
  check("paging returns page metadata", await call("GET", "/api/returns?pageSize=5&page=2"), 200, undefined,
    (r) => r.body.data.length === 5 && r.body.meta.page === 2 && r.body.meta.totalPages >= 2);
  check("no match returns an empty list, not an error", await call("GET", "/api/returns?q=zzzz-nothing"), 200, undefined,
    (r) => r.body.data.length === 0 && r.body.meta.total === 0);
  check("LIKE wildcard is treated literally", await call("GET", "/api/returns?q=%25"), 200, undefined, (r) => r.body.meta.total === 0);
  check("unknown sort column", await call("GET", "/api/returns?sort=password"), 400, "INVALID_QUERY");
  check("unknown status filter", await call("GET", "/api/returns?status=lost"), 400, "INVALID_QUERY");
  check("pageSize over the limit", await call("GET", "/api/returns?pageSize=1000"), 400, "INVALID_QUERY");

  // ---------------------------------------------------------------------------------------------
  section("Errors are honest and machine-readable");
  check("unknown request reference", await call("GET", "/api/returns/RD-999999"), 404, "NOT_FOUND");
  check("unknown order", await call("GET", "/api/orders/ORD-1"), 404, "NOT_FOUND");
  check("unsupported method is a JSON 405 with Allow", await call("PUT", "/api/returns/RD-000001", {}), 405, "METHOD_NOT_ALLOWED",
    (r) => r.headers.get("allow") === "GET, PATCH, DELETE");
  check("unknown API path is JSON, not an HTML page", await call("GET", "/api/does-not-exist"), 404, "NOT_FOUND",
    (r) => (r.headers.get("content-type") ?? "").includes("application/json"));

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("\nFailures:\n" + failures.map((f) => `  - ${f}`).join("\n"));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
