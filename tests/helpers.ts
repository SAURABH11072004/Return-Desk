import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { customers, orderItems, orders } from "@/db/schema";
import * as collection from "@/app/api/returns/route";
import * as single from "@/app/api/returns/[reference]/route";
import * as transitions from "@/app/api/returns/[reference]/transitions/route";
import * as notes from "@/app/api/returns/[reference]/notes/route";
import * as stats from "@/app/api/returns/stats/route";

/** Empty every table and insert one order with two items: SKU-A (qty 3, 100.00) and SKU-B (qty 1, 50.00). */
export async function resetDatabase() {
  const db = getDb();
  await db.execute(sql`
    TRUNCATE return_notes, return_status_changes, return_requests, order_items, orders, customers
    RESTART IDENTITY CASCADE
  `);
  await db.execute(sql`ALTER SEQUENCE return_request_reference_seq RESTART WITH 1`);
  const [customer] = await db.insert(customers).values({ name: "Test Customer", email: "test@example.com" }).returning();
  const [order] = await db
    .insert(orders)
    .values({ orderNumber: "ORD-1", customerId: customer.id, placedAt: new Date("2026-10-01T10:00:00Z") })
    .returning();
  await db.insert(orderItems).values([
    { orderId: order.id, sku: "SKU-A", productName: "Item A", unitPrice: "100.00", quantity: 3 },
    { orderId: order.id, sku: "SKU-B", productName: "Item B", unitPrice: "50.00", quantity: 1 },
  ]);
}

const BASE = "http://test.local";

function request(method: string, path: string, body?: unknown): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

type Result = { status: number; body: any }; // eslint-disable-line @typescript-eslint/no-explicit-any

async function result(response: Response): Promise<Result> {
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

const ctx = (reference: string) => ({ params: Promise.resolve({ reference }) });

/** Calls the real route handlers, so status codes and bodies are exactly what clients see. */
export const api = {
  list: async (query = "") => result(await collection.GET(request("GET", `/api/returns${query}`), undefined)),
  create: async (body: unknown) => result(await collection.POST(request("POST", "/api/returns", body), undefined)),
  get: async (ref: string) => result(await single.GET(request("GET", `/api/returns/${ref}`), ctx(ref))),
  update: async (ref: string, body: unknown) => result(await single.PATCH(request("PATCH", `/api/returns/${ref}`, body), ctx(ref))),
  remove: async (ref: string) => result(await single.DELETE(request("DELETE", `/api/returns/${ref}`), ctx(ref))),
  transition: async (ref: string, body: unknown) =>
    result(await transitions.POST(request("POST", `/api/returns/${ref}/transitions`, body), ctx(ref))),
  stats: async () => result(await stats.GET(request("GET", "/api/returns/stats"), undefined)),
  addNote: async (ref: string, body: unknown) => result(await notes.POST(request("POST", `/api/returns/${ref}/notes`, body), ctx(ref))),
};

export const validCreate = (overrides: Record<string, unknown> = {}) => ({
  orderNumber: "ORD-1",
  sku: "SKU-A",
  quantity: 1,
  reason: "damaged",
  customer: { name: "Test Customer", email: "test@example.com", phone: "+91 98765 43210" },
  ...overrides,
});

/** Create a request and walk it to `status` through legal transitions. Returns its reference. */
export async function createInStatus(
  status: "open" | "in_review" | "approved" | "rejected" | "completed",
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const created = await api.create(validCreate(overrides));
  if (created.status !== 201) throw new Error(`create failed: ${JSON.stringify(created.body)}`);
  const ref: string = created.body.data.reference;
  const steps: Record<typeof status, unknown[]> = {
    open: [],
    in_review: [{ to: "in_review" }],
    approved: [{ to: "in_review" }, { to: "approved", resolution: "replacement" }],
    rejected: [{ to: "in_review" }, { to: "rejected" }],
    completed: [{ to: "in_review" }, { to: "approved", resolution: "store_credit" }, { to: "completed" }],
  };
  for (const step of steps[status]) {
    const res = await api.transition(ref, step);
    if (res.status !== 200) throw new Error(`transition failed: ${JSON.stringify(res.body)}`);
  }
  return ref;
}
