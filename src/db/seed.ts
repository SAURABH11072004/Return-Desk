/**
 * Fills the database with demo data: customers, orders, and 44 return requests (2 of them
 * removed from the desk) covering every status x reason combination, with notes and a
 * consistent status history.
 *
 * DESTRUCTIVE: wipes all ReturnDesk tables first. Deterministic: the same data every run.
 * Usage: npm run db:seed   (after npm run db:migrate)
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "@/db/client";
import { customers, orderItems, orders, returnNotes, returnRequests, returnStatusChanges } from "@/db/schema";
import { RESOLUTIONS, RETURN_REASONS, RETURN_STATUSES, type ReturnStatus } from "@/lib/domain";

// Small seeded PRNG (mulberry32) so every run produces identical data.
let state = 20261102;
function random(): number {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.now();

const CUSTOMER_NAMES = [
  "Aarav Sharma", "Priya Nair", "Rohan Mehta", "Ananya Iyer", "Vikram Singh",
  "Sneha Kulkarni", "Arjun Reddy", "Kavya Menon", "Ishaan Gupta", "Meera Joshi",
  "Rahul Verma", "Diya Patel", "Karan Malhotra", "Nisha Rao", "Aditya Bose",
  "Pooja Desai", "Siddharth Jain", "Tara Fernandes", "Neil D'Souza", "Ritika Chawla",
];

const PRODUCTS = [
  { sku: "ORTHO-PILLOW-STD", name: "Orthopedic Memory Foam Pillow", price: "1899.00" },
  { sku: "SEAT-CUSHION-ERGO", name: "Ergonomic Seat Cushion", price: "2499.00" },
  { sku: "LUMBAR-SUPPORT", name: "Lumbar Back Support", price: "1599.00" },
  { sku: "INSOLE-ARCH-M", name: "Arch Support Insoles (M)", price: "999.00" },
  { sku: "INSOLE-ARCH-L", name: "Arch Support Insoles (L)", price: "999.00" },
  { sku: "RUN-SHOE-42", name: "Cloud Runner Shoes, Size 42", price: "4499.00" },
  { sku: "RUN-SHOE-44", name: "Cloud Runner Shoes, Size 44", price: "4499.00" },
  { sku: "NECK-PILLOW-TRVL", name: "Travel Neck Pillow", price: "1299.00" },
  { sku: "WRIST-REST-KB", name: "Keyboard Wrist Rest", price: "799.00" },
  { sku: "FOOT-REST-DESK", name: "Under-desk Foot Rest", price: "2199.00" },
  { sku: "SOCKS-COMP-3PK", name: "Compression Socks (3 pack)", price: "649.50" },
  { sku: "KNEE-PILLOW", name: "Side Sleeper Knee Pillow", price: "1199.00" },
];

const AGENTS = ["Asha (Support)", "Ben (Support)", "Chitra (Lead)", "Dev (Support)"];

const NOTE_TEMPLATES: Record<ReturnStatus, string[]> = {
  open: [
    "Customer called in; asked them to send photos of the item.",
    "Waiting on the customer to confirm a pickup slot.",
    "Logged from email. Customer prefers WhatsApp for updates.",
  ],
  in_review: [
    "Photos received. Checking with the warehouse whether this batch had issues.",
    "Order history looks clean; no previous returns for this customer.",
    "Asked the QC team to inspect the returned unit.",
  ],
  approved: [
    "Approved per return policy. Pickup scheduled.",
    "Customer happy with the outcome; courier booked.",
  ],
  rejected: [
    "Outside the 30-day window. Explained the policy to the customer.",
    "Item shows signs of heavy use; not eligible. Customer informed.",
  ],
  completed: [
    "Item received at the warehouse and inspected. Closing out.",
    "Resolution issued. Customer confirmed receipt.",
  ],
};

/** The chain of statuses a request passed through to reach `final`. */
function pathTo(final: ReturnStatus): ReturnStatus[] {
  switch (final) {
    case "open": return ["open"];
    case "in_review": return ["open", "in_review"];
    case "approved": return ["open", "in_review", "approved"];
    case "rejected": return ["open", "in_review", "rejected"];
    case "completed": return ["open", "in_review", "approved", "completed"];
  }
}

async function main() {
  const db = getDb();
  console.log("Wiping existing data...");
  await db.execute(sql`
    TRUNCATE return_notes, return_status_changes, return_requests, order_items, orders, customers
    RESTART IDENTITY CASCADE
  `);
  await db.execute(sql`ALTER SEQUENCE return_request_reference_seq RESTART WITH 1`);

  // --- Customers ----------------------------------------------------------
  const customerRows = await db
    .insert(customers)
    .values(
      CUSTOMER_NAMES.map((name, i) => ({
        name,
        email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
        phone: i % 4 === 3 ? null : `+91 98${String(10_000_000 + i * 7_919_231).slice(0, 8)}`,
      })),
    )
    .returning();

  // --- Orders and items: 36 orders with 1–3 distinct products each ---------
  const orderRows = await db
    .insert(orders)
    .values(
      Array.from({ length: 36 }, (_, i) => ({
        orderNumber: `ORD-${10_001 + i}`,
        customerId: customerRows[i % customerRows.length].id,
        placedAt: new Date(NOW - (95 - i * 2) * DAY - between(0, 20) * HOUR),
      })),
    )
    .returning();

  const itemValues = orderRows.flatMap((order, i) => {
    const count = 1 + (i % 3);
    const start = (i * 5) % PRODUCTS.length;
    return Array.from({ length: count }, (_, k) => {
      const product = PRODUCTS[(start + k) % PRODUCTS.length];
      return { orderId: order.id, sku: product.sku, productName: product.name, unitPrice: product.price, quantity: between(1, 3) };
    });
  });
  const itemRows = await db.insert(orderItems).values(itemValues).returning();

  const orderById = new Map(orderRows.map((o) => [o.id, o]));
  const customerById = new Map(customerRows.map((c) => [c.id, c]));

  // --- Return requests -----------------------------------------------------
  // Request i uses its own order item, so live requests never collide (rule 3).
  // Statuses/reasons are assigned so the first 25 requests cover every combination.
  const REQUEST_COUNT = 44;
  if (itemRows.length < REQUEST_COUNT) throw new Error("Not enough order items for the requested seed size");

  let requestCount = 0;
  let noteCount = 0;
  for (let i = 0; i < REQUEST_COUNT; i++) {
    const block = Math.floor(i / RETURN_STATUSES.length);
    const status = RETURN_STATUSES[i % RETURN_STATUSES.length];
    const reason = RETURN_REASONS[(i + block) % RETURN_REASONS.length];
    const item = itemRows[i];
    const order = orderById.get(item.orderId)!;
    const customer = customerById.get(order.customerId)!;
    const quantity = between(1, item.quantity);

    const path = pathTo(status);
    // Created between 1 and ~60 days ago, after the order was placed; later requests are newer.
    const createdAt = new Date(Math.max(order.placedAt.getTime() + DAY, NOW - (60 - i * 1.3) * DAY));
    // Each status change happens 6–30 hours after the previous one, so history is always in order.
    let clock = createdAt.getTime();
    const changeTimes = path.slice(1).map(() => new Date((clock += between(6, 30) * HOUR)));
    const lastActivity = changeTimes.at(-1) ?? createdAt;

    const decided = status === "approved" || status === "completed";
    const resolution = decided ? RESOLUTIONS[i % RESOLUTIONS.length] : null;
    const maxRefund = Number(item.unitPrice) * quantity;
    const refundAmount = resolution === "refund" ? (i % 2 ? maxRefund : maxRefund * 0.8).toFixed(2) : null;

    // Two removed requests (one Open, one Rejected) show soft delete: in the DB, not on the desk.
    const removed = i === REQUEST_COUNT - 1 || i === REQUEST_COUNT - 2;

    const [request] = await db
      .insert(returnRequests)
      .values({
        orderItemId: item.id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        quantity,
        reason,
        status: removed ? (i % 2 ? "rejected" : "open") : status,
        resolution: removed ? null : resolution,
        refundAmount: removed ? null : refundAmount,
        createdAt,
        updatedAt: lastActivity,
        deletedAt: removed ? new Date(lastActivity.getTime() + HOUR) : null,
      })
      .returning({ id: returnRequests.id, status: returnRequests.status });
    requestCount++;

    const actualPath = pathTo(request.status);
    if (actualPath.length > 1) {
      await db.insert(returnStatusChanges).values(
        actualPath.slice(1).map((to, k) => ({
          returnRequestId: request.id,
          fromStatus: actualPath[k],
          toStatus: to,
          changedAt: changeTimes[k] ?? new Date(createdAt.getTime() + (k + 1) * HOUR),
        })),
      );
    }

    // Notes on roughly two thirds of requests, written along the way.
    if (i % 3 !== 2) {
      const notes = actualPath.slice(0, between(1, actualPath.length)).map((s, k) => ({
        returnRequestId: request.id,
        author: pick(AGENTS),
        body: pick(NOTE_TEMPLATES[s]),
        createdAt: new Date(createdAt.getTime() + k * 7 * HOUR + between(1, 5) * HOUR),
      }));
      await db.insert(returnNotes).values(notes);
      noteCount += notes.length;
    }
  }

  console.log(
    `Seeded ${customerRows.length} customers, ${orderRows.length} orders, ${itemRows.length} order items, ` +
      `${requestCount} return requests (2 removed from the desk), ${noteCount} notes.`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(closeDb);
