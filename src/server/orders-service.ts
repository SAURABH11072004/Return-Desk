/** Read-only access to the store's orders, used when raising a return request. */
import { and, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { customers, orderItems, orders, returnRequests } from "@/db/schema";
import { LIVE_STATUSES } from "@/lib/domain";
import type { OrderDetail, OrderSummary } from "@/lib/api-types";
import { notFound } from "@/server/errors";

const orderColumns = {
  id: orders.id,
  orderNumber: orders.orderNumber,
  placedAt: orders.placedAt,
  customerName: customers.name,
  customerEmail: customers.email,
  customerPhone: customers.phone,
};

type OrderRow = { orderNumber: string; placedAt: Date; customerName: string; customerEmail: string; customerPhone: string | null };

function toOrderSummary(row: OrderRow): OrderSummary {
  return {
    orderNumber: row.orderNumber,
    placedAt: row.placedAt.toISOString(),
    customer: { name: row.customerName, email: row.customerEmail, phone: row.customerPhone },
  };
}

const SEARCH_LIMIT = 10;

/** Find orders by order number or customer, newest first. */
export async function searchOrders(term: string): Promise<OrderSummary[]> {
  const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await getDb()
    .select(orderColumns)
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .where(or(ilike(orders.orderNumber, pattern), ilike(customers.name, pattern), ilike(customers.email, pattern)))
    .orderBy(desc(orders.placedAt), desc(orders.id))
    .limit(SEARCH_LIMIT);
  return rows.map(toOrderSummary);
}

export async function getOrder(orderNumber: string): Promise<OrderDetail> {
  const db = getDb();
  const [order] = await db
    .select(orderColumns)
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .where(eq(orders.orderNumber, orderNumber));
  if (!order) throw notFound(`No order ${orderNumber}`);

  const items = await db
    .select({
      sku: orderItems.sku,
      productName: orderItems.productName,
      unitPrice: orderItems.unitPrice,
      quantity: orderItems.quantity,
      liveReturnReference: returnRequests.reference,
    })
    .from(orderItems)
    .leftJoin(
      returnRequests,
      and(
        eq(returnRequests.orderItemId, orderItems.id),
        inArray(returnRequests.status, [...LIVE_STATUSES]),
        isNull(returnRequests.deletedAt),
      ),
    )
    .where(eq(orderItems.orderId, order.id))
    .orderBy(orderItems.id);

  return { ...toOrderSummary(order), items };
}
