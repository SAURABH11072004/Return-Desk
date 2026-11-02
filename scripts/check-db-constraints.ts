/**
 * Proves the database itself refuses bad data, even when the API is bypassed and SQL is run
 * directly. Each statement runs in a savepoint inside one transaction that is always rolled back,
 * so the database is left exactly as it was.
 *
 * Expects freshly seeded data (npm run db:seed): RD-000001 Open (with notes), RD-000002 In Review,
 * RD-000005 Completed.
 *
 * Usage: npm run check:db      (uses DATABASE_URL from .env)
 */
import "dotenv/config";
import postgres from "postgres";

type Case = { name: string; sql: string; expect: "refused" | "allowed" };

const ref = (r: string) => `(SELECT id FROM return_requests WHERE reference = '${r}')`;
const freeItem = `(SELECT oi.id FROM order_items oi WHERE NOT EXISTS (
  SELECT 1 FROM return_requests rr WHERE rr.order_item_id = oi.id) ORDER BY oi.id DESC LIMIT 1)`;

const CASES: Case[] = [
  // Rule 3
  { name: "Rule 3: second live request for the same order item", expect: "refused",
    sql: `INSERT INTO return_requests (order_item_id, customer_name, customer_email, quantity, reason)
          SELECT order_item_id, 'X', 'x@example.com', 1, 'damaged' FROM return_requests WHERE reference = 'RD-000001'` },
  // Rule 2
  { name: "Rule 2: Approved without a resolution", expect: "refused",
    sql: `UPDATE return_requests SET status = 'approved' WHERE reference = 'RD-000002'` },
  { name: "Rule 2: Refund with amount 0", expect: "refused",
    sql: `UPDATE return_requests SET status = 'approved', resolution = 'refund', refund_amount = 0 WHERE reference = 'RD-000002'` },
  { name: "Rule 2: Refund with no amount", expect: "refused",
    sql: `UPDATE return_requests SET status = 'approved', resolution = 'refund' WHERE reference = 'RD-000002'` },
  { name: "Rule 2: Replacement with a refund amount", expect: "refused",
    sql: `UPDATE return_requests SET status = 'approved', resolution = 'replacement', refund_amount = 10 WHERE reference = 'RD-000002'` },
  { name: "Rule 2: resolution on a request that is still Open", expect: "refused",
    sql: `UPDATE return_requests SET resolution = 'store_credit' WHERE reference = 'RD-000001'` },
  // Rule 5
  { name: "Rule 5: soft-delete an In Review request", expect: "refused",
    sql: `UPDATE return_requests SET deleted_at = now() WHERE reference = 'RD-000002'` },
  { name: "Rule 5: soft-delete a Completed request", expect: "refused",
    sql: `UPDATE return_requests SET deleted_at = now() WHERE reference = 'RD-000005'` },
  { name: "Records are not destroyed: hard DELETE of a request with notes", expect: "refused",
    sql: `DELETE FROM return_requests WHERE reference = 'RD-000001'` },
  // Notes
  { name: "Notes: UPDATE a note", expect: "refused",
    sql: `UPDATE return_notes SET body = 'rewritten' WHERE return_request_id = ${ref("RD-000001")}` },
  { name: "Notes: DELETE a note", expect: "refused",
    sql: `DELETE FROM return_notes WHERE return_request_id = ${ref("RD-000001")}` },
  { name: "Notes: blank note body", expect: "refused",
    sql: `INSERT INTO return_notes (return_request_id, author, body) VALUES (${ref("RD-000001")}, 'A', '   ')` },
  // Types, references, uniqueness
  { name: "Quantity of 0", expect: "refused",
    sql: `UPDATE return_requests SET quantity = 0 WHERE reference = 'RD-000001'` },
  { name: "Status outside the enum", expect: "refused",
    sql: `UPDATE return_requests SET status = 'closed' WHERE reference = 'RD-000001'` },
  { name: "Reason outside the enum", expect: "refused",
    sql: `UPDATE return_requests SET reason = 'bored' WHERE reference = 'RD-000001'` },
  { name: "Duplicate reference", expect: "refused",
    sql: `INSERT INTO return_requests (reference, order_item_id, customer_name, customer_email, quantity, reason)
          VALUES ('RD-000001', ${freeItem}, 'X', 'x@example.com', 1, 'damaged')` },
  { name: "Request for an order item that does not exist", expect: "refused",
    sql: `INSERT INTO return_requests (order_item_id, customer_name, customer_email, quantity, reason)
          VALUES (999999, 'X', 'x@example.com', 1, 'damaged')` },
  { name: "Order item with quantity 0", expect: "refused",
    sql: `UPDATE order_items SET quantity = 0 WHERE id = 1` },
  { name: "Two customers with the same email", expect: "refused",
    sql: `INSERT INTO customers (name, email) SELECT 'Copy', email FROM customers LIMIT 1` },
  // Controls: valid changes must still go through, so the constraints are not just blocking everything.
  { name: "Control: valid Refund approval", expect: "allowed",
    sql: `UPDATE return_requests SET status = 'approved', resolution = 'refund', refund_amount = 10.50 WHERE reference = 'RD-000002'` },
  { name: "Control: soft-delete an Open request", expect: "allowed",
    sql: `UPDATE return_requests SET deleted_at = now() WHERE reference = 'RD-000001'` },
  { name: "Control: reference generated automatically", expect: "allowed",
    sql: `INSERT INTO return_requests (order_item_id, customer_name, customer_email, quantity, reason)
          VALUES (${freeItem}, 'X', 'x@example.com', 1, 'damaged')` },
];

class Rollback extends Error {}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  let failed = 0;

  try {
    await sql.begin(async (tx) => {
      for (const c of CASES) {
        let outcome: "refused" | "allowed";
        let detail = "";
        try {
          await tx.savepoint((sp) => sp.unsafe(c.sql));
          outcome = "allowed";
        } catch (error) {
          outcome = "refused";
          detail = (error as Error).message;
        }
        const ok = outcome === c.expect;
        if (!ok) failed++;
        console.log(`${ok ? "PASS" : "FAIL"}  ${c.name.padEnd(62)} → ${outcome}${detail ? `: ${detail}` : ""}`);
      }
      throw new Rollback(); // never keep any of it
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  } finally {
    await sql.end();
  }

  console.log(`\n${CASES.length - failed} passed, ${failed} failed (all changes rolled back)`);
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
