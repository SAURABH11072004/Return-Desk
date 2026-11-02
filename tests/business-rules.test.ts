import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db/client";
import { returnRequests } from "@/db/schema";
import { RETURN_STATUSES, TRANSITIONS } from "@/lib/domain";
import { api, createInStatus, resetDatabase, validCreate } from "./helpers";

beforeEach(resetDatabase);
afterAll(closeDb);

describe("raising a request", () => {
  it("creates an Open request with a generated reference and returns 201 + Location", async () => {
    const res = await api.create(validCreate());
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ reference: "RD-000001", status: "open", quantity: 1, reason: "damaged" });
    expect(res.body.data.allowedActions).toEqual({ transitions: ["in_review"], canEdit: true, canRemove: true, canAddNote: true });
  });

  it("refuses a client-supplied reference (the server generates it)", async () => {
    const res = await api.create(validCreate({ reference: "MINE-1" }));
    expect(res.status).toBe(422);
  });

  it("rejects malformed JSON with 400 and invalid fields with 422", async () => {
    expect((await api.create("{not json")).status).toBe(400);
    const res = await api.create(validCreate({ quantity: 0, reason: "bored" }));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(res.body.error.details.issues.map((i: { path: string }) => i.path)).toEqual(["quantity", "reason"]);
  });

  it("refuses an unknown order item or more units than were ordered", async () => {
    expect((await api.create(validCreate({ sku: "NOPE" }))).body.error.code).toBe("ORDER_ITEM_NOT_FOUND");
    const res = await api.create(validCreate({ quantity: 4 }));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("QUANTITY_EXCEEDS_ORDERED");
  });
});

describe("rule 1: status flow", () => {
  it("allows exactly the legal transitions from every status", async () => {
    for (const from of RETURN_STATUSES) {
      for (const to of RETURN_STATUSES) {
        await resetDatabase();
        const ref = await createInStatus(from);
        const body = to === "approved" ? { to, resolution: "replacement" } : { to };
        const res = await api.transition(ref, body);
        const legal = TRANSITIONS[from].includes(to);
        expect({ from, to, status: res.status }).toEqual({ from, to, status: legal ? 200 : 409 });
        if (!legal) expect(res.body.error.code).toBe("INVALID_TRANSITION");
      }
    }
  });

  it("explains an illegal move, e.g. Open straight to Completed", async () => {
    const ref = await createInStatus("open");
    const res = await api.transition(ref, { to: "completed" });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: "INVALID_TRANSITION", details: { from: "open", to: "completed", allowed: ["in_review"] } });
  });

  it("records every status change in the history", async () => {
    const ref = await createInStatus("completed");
    const res = await api.get(ref);
    expect(res.body.data.statusHistory.map((h: { from: string; to: string }) => `${h.from}->${h.to}`)).toEqual([
      "open->in_review",
      "in_review->approved",
      "approved->completed",
    ]);
  });
});

describe("rule 2: approval needs a resolution", () => {
  let ref: string;
  beforeEach(async () => {
    ref = await createInStatus("in_review");
  });

  it("refuses approval without a resolution", async () => {
    const res = await api.transition(ref, { to: "approved" });
    expect(res.status).toBe(422);
    expect(res.body.error.details.issues[0].path).toBe("resolution");
  });

  it("requires a refund amount greater than zero for a refund", async () => {
    expect((await api.transition(ref, { to: "approved", resolution: "refund" })).status).toBe(422);
    expect((await api.transition(ref, { to: "approved", resolution: "refund", refundAmount: 0 })).status).toBe(422);
    expect((await api.transition(ref, { to: "approved", resolution: "refund", refundAmount: -5 })).status).toBe(422);
  });

  it("refuses a refund amount for replacement or store credit", async () => {
    const res = await api.transition(ref, { to: "approved", resolution: "store_credit", refundAmount: 10 });
    expect(res.status).toBe(422);
    expect(res.body.error.details.issues[0].path).toBe("refundAmount");
  });

  it("refuses a refund larger than what was paid for the returned units", async () => {
    const res = await api.transition(ref, { to: "approved", resolution: "refund", refundAmount: 100.01 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("REFUND_EXCEEDS_ITEM_VALUE");
  });

  it("approves a refund with a valid amount", async () => {
    const res = await api.transition(ref, { to: "approved", resolution: "refund", refundAmount: 99.5 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "approved", resolution: "refund", refundAmount: "99.50" });
  });

  it("is also enforced by the database: a refund with no amount is refused even bypassing the API", async () => {
    await expect(
      getDb().execute(sql`UPDATE return_requests SET status = 'approved', resolution = 'refund', refund_amount = NULL WHERE reference = ${ref}`),
    ).rejects.toThrow();
  });

  it("refuses a resolution on any other transition", async () => {
    const res = await api.transition(ref, { to: "rejected", resolution: "refund", refundAmount: 5 });
    expect(res.status).toBe(422);
  });
});

describe("rule 3: one live request per item", () => {
  it.each(["open", "in_review", "approved"] as const)("refuses a second request while the first is %s", async (status) => {
    const first = await createInStatus(status);
    const res = await api.create(validCreate());
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: "DUPLICATE_LIVE_REQUEST", details: { existingReference: first } });
  });

  it.each(["rejected", "completed"] as const)("allows a new request once the first is %s", async (status) => {
    await createInStatus(status);
    expect((await api.create(validCreate())).status).toBe(201);
  });

  it("allows a request for a different item on the same order", async () => {
    await createInStatus("open");
    expect((await api.create(validCreate({ sku: "SKU-B" }))).status).toBe(201);
  });

  it("holds under concurrency: of two simultaneous creates, exactly one wins", async () => {
    const results = await Promise.all([api.create(validCreate()), api.create(validCreate())]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it("refuses moving a request onto an item that already has a live request", async () => {
    await createInStatus("open");
    const other = await createInStatus("open", { sku: "SKU-B" });
    const res = await api.update(other, { sku: "SKU-A" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE_LIVE_REQUEST");
  });
});

describe("rule 4: locked once decided", () => {
  it.each(["open", "in_review"] as const)("allows corrections while %s", async (status) => {
    const ref = await createInStatus(status);
    const res = await api.update(ref, { quantity: 2, customer: { phone: null, name: "Corrected Name" } });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ quantity: 2, customer: { name: "Corrected Name", phone: null } });
  });

  it.each(["approved", "rejected", "completed"] as const)("refuses edits once %s, but still accepts notes", async (status) => {
    const ref = await createInStatus(status);
    const res = await api.update(ref, { customer: { name: "Someone Else" } });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("REQUEST_LOCKED");
    expect((await api.addNote(ref, { author: "Agent", body: "Still talking to the customer" })).status).toBe(201);
  });

  it("does not allow status to be changed through the edit endpoint", async () => {
    const ref = await createInStatus("open");
    expect((await api.update(ref, { status: "completed" })).status).toBe(422);
  });
});

describe("rule 5: removal", () => {
  it.each(["open", "rejected"] as const)("soft-deletes when %s: gone from the desk, kept in the database", async (status) => {
    const ref = await createInStatus(status);
    expect((await api.remove(ref)).status).toBe(204);
    expect((await api.get(ref)).status).toBe(404);
    expect((await api.list()).body.meta.total).toBe(0);
    expect((await api.addNote(ref, { author: "A", body: "x" })).status).toBe(404);
    expect((await api.remove(ref)).status).toBe(404);

    const [row] = await getDb().select().from(returnRequests).where(eq(returnRequests.reference, ref));
    expect(row.deletedAt).toBeInstanceOf(Date);
  });

  it.each(["in_review", "approved", "completed"] as const)("refuses removal when %s", async (status) => {
    const ref = await createInStatus(status);
    const res = await api.remove(ref);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("REMOVAL_NOT_ALLOWED");
  });

  it("a removed Open request no longer blocks a new one for the same item", async () => {
    const ref = await createInStatus("open");
    await api.remove(ref);
    expect((await api.create(validCreate())).status).toBe(201);
  });
});

describe("notes", () => {
  it("are returned oldest first and cannot be changed, even directly in the database", async () => {
    const ref = await createInStatus("open");
    await api.addNote(ref, { author: "Asha", body: "First" });
    await api.addNote(ref, { author: "Ben", body: "Second" });
    const res = await api.get(ref);
    expect(res.body.data.notes.map((n: { body: string }) => n.body)).toEqual(["First", "Second"]);

    await expect(getDb().execute(sql`UPDATE return_notes SET body = 'edited'`)).rejects.toThrow();
    await expect(getDb().execute(sql`DELETE FROM return_notes`)).rejects.toThrow();
  });

  it("rejects a blank note", async () => {
    const ref = await createInStatus("open");
    expect((await api.addNote(ref, { author: "Asha", body: "   " })).status).toBe(422);
  });
});

describe("finding requests", () => {
  beforeEach(async () => {
    await createInStatus("open", { customer: { name: "Zara Khan", email: "zara@example.com" } });
    await createInStatus("rejected", { sku: "SKU-B", reason: "size_issue", customer: { name: "Amit Roy", email: "amit@example.com" } });
  });

  it("searches by customer, order and reference", async () => {
    expect((await api.list("?q=zara")).body.data.map((r: { reference: string }) => r.reference)).toEqual(["RD-000001"]);
    expect((await api.list("?q=ORD-1")).body.meta.total).toBe(2);
    expect((await api.list("?q=000002")).body.data[0].customer.name).toBe("Amit Roy");
  });

  it("treats LIKE wildcards in the search as literal text", async () => {
    expect((await api.list("?q=%25")).body.meta.total).toBe(0);
  });

  it("combines filters, sorting and paging", async () => {
    const filtered = await api.list("?status=rejected&reason=size_issue");
    expect(filtered.body.data).toHaveLength(1);

    const page2 = await api.list("?sort=customerName&dir=asc&pageSize=1&page=2");
    expect(page2.body.data[0].customer.name).toBe("Zara Khan");
    expect(page2.body.meta).toEqual({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
  });

  it("rejects invalid query parameters with 400", async () => {
    const res = await api.list("?sort=password&pageSize=1000");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_QUERY");
  });
});

describe("dashboard stats", () => {
  it("counts requests per status from the database, excluding removed ones", async () => {
    await createInStatus("open");
    await createInStatus("completed", { sku: "SKU-B" });
    const removed = await createInStatus("open", { sku: "SKU-B" });
    await api.remove(removed);

    const res = await api.stats();
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      total: 2,
      byStatus: { open: 1, in_review: 0, approved: 0, rejected: 0, completed: 1 },
      raisedLast7Days: 2,
      closedLast7Days: 1,
    });
  });
});
