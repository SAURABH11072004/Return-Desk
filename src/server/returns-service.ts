/**
 * Everything ReturnDesk does to a return request. Each mutation runs in a transaction that
 * locks the request row (SELECT ... FOR UPDATE) before checking a rule, so two agents acting
 * on the same request at once cannot both pass a check that only one of them should.
 */
import { and, asc, count, desc, eq, ilike, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { getDb, type Db, type Tx } from "@/db/client";
import { orderItems, orders, returnNotes, returnRequests, returnStatusChanges } from "@/db/schema";
import {
  allowedActions,
  canTransition,
  isEditable,
  isRemovable,
  LIVE_STATUSES,
  STATUS_LABELS,
  TRANSITIONS,
} from "@/lib/domain";
import type { PageMeta, ReturnDetail, ReturnNote, ReturnSummary } from "@/lib/api-types";
import {
  resolutionIssues,
  type CreateNoteInput,
  type CreateReturnInput,
  type ListReturnsQuery,
  type ReturnSortField,
  type TransitionInput,
  type UpdateReturnInput,
} from "@/lib/validation";
import { conflict, notFound, unprocessable, validationFailed } from "@/server/errors";

const rr = returnRequests;

const summaryColumns = {
  id: rr.id,
  reference: rr.reference,
  status: rr.status,
  reason: rr.reason,
  quantity: rr.quantity,
  customerName: rr.customerName,
  customerEmail: rr.customerEmail,
  customerPhone: rr.customerPhone,
  resolution: rr.resolution,
  refundAmount: rr.refundAmount,
  createdAt: rr.createdAt,
  updatedAt: rr.updatedAt,
  orderNumber: orders.orderNumber,
  placedAt: orders.placedAt,
  sku: orderItems.sku,
  productName: orderItems.productName,
  unitPrice: orderItems.unitPrice,
  orderedQuantity: orderItems.quantity,
};

function selectSummaries(db: Db | Tx) {
  return db
    .select(summaryColumns)
    .from(rr)
    .innerJoin(orderItems, eq(orderItems.id, rr.orderItemId))
    .innerJoin(orders, eq(orders.id, orderItems.orderId));
}

type SummaryRow = Awaited<ReturnType<typeof selectSummaries>>[number];

function toSummary(row: SummaryRow): ReturnSummary {
  return {
    reference: row.reference,
    status: row.status,
    reason: row.reason,
    quantity: row.quantity,
    customer: { name: row.customerName, email: row.customerEmail, phone: row.customerPhone },
    order: { orderNumber: row.orderNumber, placedAt: row.placedAt.toISOString() },
    item: {
      sku: row.sku,
      productName: row.productName,
      unitPrice: row.unitPrice,
      orderedQuantity: row.orderedQuantity,
    },
    resolution: row.resolution,
    refundAmount: row.refundAmount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const notOnDesk = (reference: string) => notFound(`No return request ${reference} on the desk`);

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

const SORT_COLUMNS: Record<ReturnSortField, SQL> = {
  createdAt: sql`${rr.createdAt}`,
  updatedAt: sql`${rr.updatedAt}`,
  reference: sql`${rr.reference}`,
  customerName: sql`lower(${rr.customerName})`,
  status: sql`${rr.status}`, // enum order = lifecycle order
};

/** Escape LIKE wildcards so a search for "50%" means the literal text. */
function containsPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function listReturns(query: ListReturnsQuery): Promise<{ data: ReturnSummary[]; meta: PageMeta }> {
  const db = getDb();
  const pattern = query.q ? containsPattern(query.q) : undefined;

  const where = and(
    isNull(rr.deletedAt),
    query.status.length ? inArray(rr.status, query.status) : undefined,
    query.reason.length ? inArray(rr.reason, query.reason) : undefined,
    pattern
      ? or(
          ilike(rr.reference, pattern),
          ilike(rr.customerName, pattern),
          ilike(rr.customerEmail, pattern),
          ilike(orders.orderNumber, pattern),
        )
      : undefined,
  );

  const direction = query.dir === "asc" ? asc : desc;
  const offset = (query.page - 1) * query.pageSize;

  const [rows, [{ total }]] = await Promise.all([
    selectSummaries(db)
      .where(where)
      // id as a tie-breaker keeps paging stable when the sort column has duplicates.
      .orderBy(direction(SORT_COLUMNS[query.sort]), direction(rr.id))
      .limit(query.pageSize)
      .offset(offset),
    db
      .select({ total: count() })
      .from(rr)
      .innerJoin(orderItems, eq(orderItems.id, rr.orderItemId))
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(where),
  ]);

  return {
    data: rows.map(toSummary),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}

async function findRequestId(db: Db | Tx, reference: string): Promise<number> {
  const [row] = await db
    .select({ id: rr.id })
    .from(rr)
    .where(and(eq(rr.reference, reference), isNull(rr.deletedAt)));
  if (!row) throw notOnDesk(reference);
  return row.id;
}

export async function getReturn(reference: string): Promise<ReturnDetail> {
  const db = getDb();
  const [row] = await selectSummaries(db).where(and(eq(rr.reference, reference), isNull(rr.deletedAt)));
  if (!row) throw notOnDesk(reference);

  const [notes, history] = await Promise.all([
    selectNotes(db, row.id),
    db
      .select({ from: returnStatusChanges.fromStatus, to: returnStatusChanges.toStatus, changedAt: returnStatusChanges.changedAt })
      .from(returnStatusChanges)
      .where(eq(returnStatusChanges.returnRequestId, row.id))
      .orderBy(asc(returnStatusChanges.changedAt), asc(returnStatusChanges.id)),
  ]);

  return {
    ...toSummary(row),
    allowedActions: allowedActions(row.status),
    notes,
    statusHistory: history.map((h) => ({ ...h, changedAt: h.changedAt.toISOString() })),
  };
}

async function selectNotes(db: Db | Tx, requestId: number): Promise<ReturnNote[]> {
  const rows = await db
    .select({ id: returnNotes.id, author: returnNotes.author, body: returnNotes.body, createdAt: returnNotes.createdAt })
    .from(returnNotes)
    .where(eq(returnNotes.returnRequestId, requestId))
    .orderBy(asc(returnNotes.createdAt), asc(returnNotes.id));
  return rows.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }));
}

export async function listNotes(reference: string): Promise<ReturnNote[]> {
  const db = getDb();
  return selectNotes(db, await findRequestId(db, reference));
}

// ---------------------------------------------------------------------------
// Shared checks
// ---------------------------------------------------------------------------

/** Lock the request row for the rest of the transaction. Removed requests are not on the desk. */
async function lockRequest(tx: Tx, reference: string) {
  const [row] = await tx
    .select()
    .from(rr)
    .where(and(eq(rr.reference, reference), isNull(rr.deletedAt)))
    .for("update");
  if (!row) throw notOnDesk(reference);
  return row;
}

async function findOrderItem(tx: Tx, orderNumber: string, sku: string) {
  const [item] = await tx
    .select({ id: orderItems.id, quantity: orderItems.quantity, unitPrice: orderItems.unitPrice })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orders.orderNumber, orderNumber), eq(orderItems.sku, sku)));
  if (!item) {
    throw unprocessable("ORDER_ITEM_NOT_FOUND", `Order ${orderNumber} has no item with SKU ${sku}`, { orderNumber, sku });
  }
  return item;
}

function assertQuantityWithinOrder(requested: number, ordered: number) {
  if (requested > ordered) {
    throw unprocessable(
      "QUANTITY_EXCEEDS_ORDERED",
      `Cannot return ${requested} units: only ${ordered} were ordered`,
      { requested, ordered },
    );
  }
}

/** Rule 3. The partial unique index backs this up if two creates race. */
async function assertNoLiveRequest(tx: Tx, orderItemId: number, exceptRequestId?: number) {
  const [existing] = await tx
    .select({ reference: rr.reference, status: rr.status })
    .from(rr)
    .where(
      and(
        eq(rr.orderItemId, orderItemId),
        inArray(rr.status, [...LIVE_STATUSES]),
        isNull(rr.deletedAt),
        exceptRequestId === undefined ? undefined : ne(rr.id, exceptRequestId),
      ),
    );
  if (existing) {
    throw conflict(
      "DUPLICATE_LIVE_REQUEST",
      `This item already has a live return request (${existing.reference}, ${STATUS_LABELS[existing.status]}). ` +
        "A new one can be raised once it is Rejected or Completed.",
      { existingReference: existing.reference, existingStatus: existing.status },
    );
  }
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export async function createReturn(input: CreateReturnInput): Promise<ReturnDetail> {
  const reference = await getDb().transaction(async (tx) => {
    const item = await findOrderItem(tx, input.orderNumber, input.sku);
    assertQuantityWithinOrder(input.quantity, item.quantity);
    await assertNoLiveRequest(tx, item.id);

    const [created] = await tx
      .insert(rr)
      .values({
        orderItemId: item.id,
        customerName: input.customer.name,
        customerEmail: input.customer.email,
        customerPhone: input.customer.phone ?? null,
        quantity: input.quantity,
        reason: input.reason,
      })
      .returning({ reference: rr.reference });
    return created.reference;
  });
  return getReturn(reference);
}

/** Rule 4: corrections are only allowed before the request is decided. */
export async function updateReturn(reference: string, input: UpdateReturnInput): Promise<ReturnDetail> {
  await getDb().transaction(async (tx) => {
    const current = await lockRequest(tx, reference);
    if (!isEditable(current.status)) {
      throw conflict(
        "REQUEST_LOCKED",
        `${reference} is ${STATUS_LABELS[current.status]}; its customer and item details can no longer be edited. Notes can still be added.`,
        { status: current.status },
      );
    }

    let orderItemId = current.orderItemId;
    let orderedQuantity: number;
    if (input.orderNumber !== undefined || input.sku !== undefined) {
      const [currentItem] = await tx
        .select({ orderNumber: orders.orderNumber, sku: orderItems.sku })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(eq(orderItems.id, current.orderItemId));
      const item = await findOrderItem(tx, input.orderNumber ?? currentItem.orderNumber, input.sku ?? currentItem.sku);
      if (item.id !== current.orderItemId) await assertNoLiveRequest(tx, item.id, current.id);
      orderItemId = item.id;
      orderedQuantity = item.quantity;
    } else {
      const [item] = await tx.select({ quantity: orderItems.quantity }).from(orderItems).where(eq(orderItems.id, orderItemId));
      orderedQuantity = item.quantity;
    }
    assertQuantityWithinOrder(input.quantity ?? current.quantity, orderedQuantity);

    await tx
      .update(rr)
      .set({
        orderItemId,
        quantity: input.quantity,
        reason: input.reason,
        customerName: input.customer?.name,
        customerEmail: input.customer?.email,
        // undefined = leave as is, null = clear
        customerPhone: input.customer?.phone,
        updatedAt: sql`now()`,
      })
      .where(eq(rr.id, current.id));
  });
  return getReturn(reference);
}

/** Rules 1 and 2. */
export async function transitionReturn(reference: string, input: TransitionInput): Promise<ReturnDetail> {
  await getDb().transaction(async (tx) => {
    const current = await lockRequest(tx, reference);

    if (!canTransition(current.status, input.to)) {
      const allowed = TRANSITIONS[current.status];
      throw conflict(
        "INVALID_TRANSITION",
        allowed.length
          ? `Cannot move ${reference} from ${STATUS_LABELS[current.status]} to ${STATUS_LABELS[input.to]}. ` +
              `Allowed next: ${allowed.map((s) => STATUS_LABELS[s]).join(", ")}.`
          : `${reference} is ${STATUS_LABELS[current.status]}, which is final. Its status cannot change.`,
        { from: current.status, to: input.to, allowed },
      );
    }

    const issues = resolutionIssues(input);
    if (issues.length) throw validationFailed(issues);

    if (input.to === "approved" && input.refundAmount !== undefined) {
      const [item] = await tx.select({ unitPrice: orderItems.unitPrice }).from(orderItems).where(eq(orderItems.id, current.orderItemId));
      const maxCents = Math.round(Number(item.unitPrice) * 100) * current.quantity;
      if (Math.round(input.refundAmount * 100) > maxCents) {
        const max = (maxCents / 100).toFixed(2);
        throw unprocessable(
          "REFUND_EXCEEDS_ITEM_VALUE",
          `Refund cannot exceed what was paid for the returned units (${max})`,
          { maxRefundAmount: max },
        );
      }
    }

    await tx
      .update(rr)
      .set({
        status: input.to,
        ...(input.to === "approved" && {
          resolution: input.resolution,
          refundAmount: input.refundAmount === undefined ? null : input.refundAmount.toFixed(2),
        }),
        updatedAt: sql`now()`,
      })
      .where(eq(rr.id, current.id));

    await tx.insert(returnStatusChanges).values({ returnRequestId: current.id, fromStatus: current.status, toStatus: input.to });
  });
  return getReturn(reference);
}

/** Rule 5: a soft delete. The row stays; it just stops being on the desk. */
export async function removeReturn(reference: string): Promise<void> {
  await getDb().transaction(async (tx) => {
    const current = await lockRequest(tx, reference);
    if (!isRemovable(current.status)) {
      throw conflict(
        "REMOVAL_NOT_ALLOWED",
        `${reference} is ${STATUS_LABELS[current.status]}. Only Open or Rejected requests can be removed from the desk.`,
        { status: current.status },
      );
    }
    await tx.update(rr).set({ deletedAt: sql`now()`, updatedAt: sql`now()` }).where(eq(rr.id, current.id));
  });
}

/** Notes can be added in any status, and are never edited or deleted. */
export async function addNote(reference: string, input: CreateNoteInput): Promise<ReturnNote> {
  const db = getDb();
  const requestId = await findRequestId(db, reference);
  const [note] = await db
    .insert(returnNotes)
    .values({ returnRequestId: requestId, author: input.author, body: input.body })
    .returning({ id: returnNotes.id, author: returnNotes.author, body: returnNotes.body, createdAt: returnNotes.createdAt });
  return { ...note, createdAt: note.createdAt.toISOString() };
}
