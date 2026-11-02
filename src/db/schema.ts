import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { RESOLUTIONS, RETURN_REASONS, RETURN_STATUSES } from "@/lib/domain";

export const returnStatus = pgEnum("return_status", RETURN_STATUSES);
export const returnReason = pgEnum("return_reason", RETURN_REASONS);
export const resolution = pgEnum("resolution", RESOLUTIONS);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ---------------------------------------------------------------------------
// The store's own data. ReturnDesk does not manage these; it raises requests against them.
// ---------------------------------------------------------------------------

export const customers = pgTable("customers", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  email: text().notNull().unique(),
  phone: text(),
  createdAt: createdAt(),
});

export const orders = pgTable(
  "orders",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    orderNumber: text("order_number").notNull().unique(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    placedAt: timestamp("placed_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("orders_customer_id_idx").on(t.customerId),
    index("orders_order_number_trgm_idx").using("gin", t.orderNumber.op("gin_trgm_ops")),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    sku: text().notNull(),
    productName: text("product_name").notNull(),
    unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
    quantity: integer().notNull(),
  },
  (t) => [
    unique("order_items_order_id_sku_key").on(t.orderId, t.sku),
    check("order_items_quantity_positive", sql`${t.quantity} > 0`),
    check("order_items_unit_price_non_negative", sql`${t.unitPrice} >= 0`),
  ],
);

// ---------------------------------------------------------------------------
// ReturnDesk
// ---------------------------------------------------------------------------

/** Backs the human-readable reference (RD-000001). A sequence cannot hand out the same value twice. */
export const returnReferenceSeq = pgSequence("return_request_reference_seq", { startWith: 1 });

export const returnRequests = pgTable(
  "return_requests",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    reference: text()
      .notNull()
      .unique()
      .default(sql`('RD-' || lpad(nextval('return_request_reference_seq')::text, 6, '0'))`),
    orderItemId: integer("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "restrict" }),
    // How to reach the customer about this return. Captured on the request (prefilled from the
    // order's customer) so an agent can correct it without rewriting the store's customer record.
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone"),
    quantity: integer().notNull(),
    reason: returnReason().notNull(),
    status: returnStatus().notNull().default("open"),
    resolution: resolution(),
    refundAmount: numeric("refund_amount", { precision: 10, scale: 2 }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    check("return_requests_quantity_positive", sql`${t.quantity} > 0`),
    // Rule 2: a refund needs a positive amount; any other resolution (or none) records no amount.
    check(
      "return_requests_refund_amount_matches_resolution",
      sql`(${t.resolution} = 'refund' AND ${t.refundAmount} > 0)
          OR (${t.resolution} IS DISTINCT FROM 'refund' AND ${t.refundAmount} IS NULL)`,
    ),
    // Rule 2: approved (and therefore completed) requests always carry a resolution; others never do.
    check(
      "return_requests_resolution_matches_status",
      sql`(${t.status} IN ('approved', 'completed')) = (${t.resolution} IS NOT NULL)`,
    ),
    // Rule 5: only open or rejected requests can be taken off the desk.
    check(
      "return_requests_removed_only_when_open_or_rejected",
      sql`${t.deletedAt} IS NULL OR ${t.status} IN ('open', 'rejected')`,
    ),
    // Rule 3: at most one live request per order item. Enforced by the database so two
    // concurrent creates cannot both succeed.
    uniqueIndex("return_requests_one_live_per_order_item")
      .on(t.orderItemId)
      .where(sql`${t.status} IN ('open', 'in_review', 'approved') AND ${t.deletedAt} IS NULL`),
    // The desk list: always filters out removed rows, usually newest first.
    index("return_requests_active_created_at_idx")
      .on(t.createdAt.desc(), t.id.desc())
      .where(sql`${t.deletedAt} IS NULL`),
    index("return_requests_status_idx").on(t.status).where(sql`${t.deletedAt} IS NULL`),
    index("return_requests_reason_idx").on(t.reason).where(sql`${t.deletedAt} IS NULL`),
    // Substring search (ILIKE '%term%') can use trigram indexes.
    index("return_requests_reference_trgm_idx").using("gin", t.reference.op("gin_trgm_ops")),
    index("return_requests_customer_name_trgm_idx").using("gin", t.customerName.op("gin_trgm_ops")),
    index("return_requests_customer_email_trgm_idx").using("gin", t.customerEmail.op("gin_trgm_ops")),
  ],
);

/** Append-only: a database trigger rejects UPDATE and DELETE on this table. */
export const returnNotes = pgTable(
  "return_notes",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    returnRequestId: integer("return_request_id")
      .notNull()
      .references(() => returnRequests.id, { onDelete: "restrict" }),
    author: text().notNull(),
    body: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("return_notes_body_not_blank", sql`length(btrim(${t.body})) > 0`),
    check("return_notes_author_not_blank", sql`length(btrim(${t.author})) > 0`),
    index("return_notes_request_created_idx").on(t.returnRequestId, t.createdAt, t.id),
  ],
);

/** Audit trail of every status change, written in the same transaction as the change. */
export const returnStatusChanges = pgTable(
  "return_status_changes",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    returnRequestId: integer("return_request_id")
      .notNull()
      .references(() => returnRequests.id, { onDelete: "restrict" }),
    fromStatus: returnStatus("from_status").notNull(),
    toStatus: returnStatus("to_status").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("return_status_changes_request_idx").on(t.returnRequestId, t.changedAt)],
);
