# ReturnDesk

A returns desk for a small online store. Agents raise return requests against orders, find them
again on a busy desk, move them through a fixed lifecycle, decide the resolution (refund,
replacement or store credit), keep an append-only trail of notes, and take requests off the desk
without destroying the record.

**Live app:** _DEPLOYED_URL_ (seeded with demo data)

Stack: Next.js 16 (App Router, route handlers) · React 19 · TypeScript · PostgreSQL · Drizzle ORM ·
Zod · Tailwind CSS 4 · Vitest.

---

## Contents

- [Running it locally](#running-it-locally)
- [Deploying](#deploying)
- [Project layout](#project-layout)
- [Data model](#data-model)
- [How the business rules are enforced](#how-the-business-rules-are-enforced)
- [API](#api)
- [Frontend](#frontend)
- [Design decisions (and what I did not choose)](#design-decisions-and-what-i-did-not-choose)
- [Assumptions about gaps in the brief](#assumptions-about-gaps-in-the-brief)
- [Status: what is done, what is not](#status-what-is-done-what-is-not)
- [Time spent](#time-spent)

---

## Running it locally

**Requirements:** Node.js 20.9+ and a PostgreSQL 14+ database. The easiest way to get the
database is Docker.

```bash
git clone <this repo> returndesk && cd returndesk
npm install
cp .env.example .env          # defaults match the Docker database below

docker compose up -d          # Postgres 16 on localhost:5433 (also creates returndesk_test)
npm run db:setup              # = db:migrate (build schema from empty) + db:seed (demo data)
npm run dev                   # http://localhost:3000
```

**Without Docker:** create an empty database in any Postgres, put its connection string in
`DATABASE_URL` in `.env`, then run `npm run db:setup`. The migrations create the `pg_trgm`
extension, so the database user needs permission to do that. Neon, Supabase and a default local
install all allow it.

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run db:migrate` | Apply the SQL migrations in `drizzle/` to `DATABASE_URL` |
| `npm run db:seed` | **Wipe** all ReturnDesk tables and load the demo data (deterministic) |
| `npm run db:setup` | Migrate, then seed |
| `npm test` | Integration tests against `TEST_DATABASE_URL` (a separate database the tests wipe) |
| `npm run typecheck` / `npm run lint` | Type check / lint |

### Environment variables

See [.env.example](.env.example).

| Variable | Needed by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | app, migrations, seed | Postgres connection string |
| `TEST_DATABASE_URL` | `npm test` only | A disposable database for the integration tests. Must differ from `DATABASE_URL`. |

### Seed data

`npm run db:seed` creates 20 customers, 36 orders and 72 order items, plus **44 return requests**.
42 are on the desk and 2 have been removed (one Open, one Rejected), so soft delete can be seen in
the database. The requests cover **all 25 status × reason combinations**, have a consistent status
history, and about two thirds of them have notes. The seed respects every business rule, and it is
deterministic: it uses a seeded PRNG, so every run produces the same data.

---

## Deploying

The live app runs on **Vercel**, with **Neon** for Postgres.

1. Create a Neon project and copy its connection string (pooled is fine; it includes `sslmode=require`).
2. From your machine, build and seed the hosted database:
   `DATABASE_URL="<neon url>" npm run db:setup`
3. Import the GitHub repo into Vercel, set `DATABASE_URL` to the same string, and deploy.

Migrations are deliberately run from a developer machine (or CI), not during the Vercel build. A
build should not mutate production data, and the seed is destructive.

---

## Project layout

```
drizzle/                     SQL migrations (generated from the schema + one hand-written trigger)
src/
  lib/                       Shared by server and browser. No I/O except api-client.
    domain.ts                Statuses, reasons, resolutions, legal transitions, which states are editable/removable
    validation.ts            Zod schemas for every request payload and the list query
    api-types.ts             Response shapes (the API contract)
    api-client.ts            Browser fetch wrapper: non-2xx responses become errors carrying the server's message
  db/
    schema.ts                Tables, enums, constraints, indexes
    client.ts                Lazily created connection pool
    seed.ts                  Demo data
  server/
    returns-service.ts       All reads and writes of return requests and the business rules
    orders-service.ts        Read-only order lookup used when raising a request
    errors.ts                ApiError and the error codes
    http.ts                  JSON parsing, query parsing, error-to-response mapping
  app/
    api/...                  Route handlers: thin, parse input, call a service, choose the status code
    returns/...              Pages: desk list, request detail, raise a request
  components/, hooks/        Small UI building blocks
tests/                       Integration tests (call the real route handlers against Postgres)
```

The dependency direction is `app/api → server → db`, and everything may import `lib`. The UI only
talks to the database through the HTTP API, so the browser is held to the same rules as any
other client.

---

## Data model

```
customers (id, name, email UNIQUE, phone)
    1 ─── * orders (id, order_number UNIQUE, customer_id FK, placed_at)
                1 ─── * order_items (id, order_id FK, sku, product_name, unit_price numeric(10,2), quantity)
                                     UNIQUE (order_id, sku)
                            1 ─── * return_requests
                                       id, reference UNIQUE (RD-000001, from a sequence)
                                       order_item_id FK
                                       customer_name, customer_email, customer_phone
                                       quantity, reason enum, status enum, resolution enum NULL,
                                       refund_amount numeric(10,2) NULL,
                                       created_at, updated_at, deleted_at NULL
                                          1 ─── * return_notes (append-only)
                                          1 ─── * return_status_changes (audit trail)
```

Choices worth calling out:

- **A request points at an `order_item`, not at "an order + a SKU string".** "The same item on
  the same order" then means one foreign key, which makes rule 3 a single partial unique index.
  It also means a request cannot reference an item that was never bought, and the quantity can be
  checked against what was ordered.
- **Customer contact is stored on the request.** It is prefilled from the order's customer. The
  brief says a request "records who the customer is and how to reach them" and that those details
  can be corrected until a decision is made. Correcting a phone number for one return should not
  silently rewrite the store's customer record or other returns, so the request keeps its own copy.
- **Postgres enums** for status, reason and resolution. Their values come from
  `src/lib/domain.ts`, so the code and the database share one list. Enum order is lifecycle order,
  so "sort by status" sorts by workflow.
- **`numeric(10,2)` for money**, never float. The API returns money as a decimal string (`"49.99"`).
- **`timestamptz`** everywhere.
- **The reference comes from a sequence:** `'RD-' || lpad(nextval(...), 6, '0')` as the column
  default. A sequence cannot hand out the same value twice, so there is no collision handling, and
  the client never supplies the reference (sending one is rejected as an unknown field).
- **Soft delete** with `deleted_at`. Partial indexes `WHERE deleted_at IS NULL` keep the desk
  queries fast.
- **Trigram (GIN) indexes** on reference, customer name, customer email and order number, so the
  `ILIKE '%term%'` search can use an index rather than scanning every row as the desk grows.
- **`ON DELETE RESTRICT`** on every foreign key. Nothing in this domain should vanish by cascade.

---

## How the business rules are enforced

Every rule is enforced on the server. Where a rule is a pure invariant of the data, the database
enforces it too, so a bug or a race in application code still cannot corrupt the data. The
application check exists to give a clear, specific error. The database check is the safety net.

| Rule | Application (gives the clear error) | Database (safety net) | Refusal |
| --- | --- | --- | --- |
| 1. Status flow | `TRANSITIONS` map in `domain.ts`, checked in `transitionReturn` after locking the row | (none: see below) | `409 INVALID_TRANSITION` with `from`, `to` and `allowed` |
| 2. Approval needs a resolution | `resolutionIssues()` in `validation.ts` | `CHECK`: approved/completed ⇔ resolution set; refund ⇔ amount > 0, otherwise amount NULL | `422 VALIDATION_FAILED` with the field |
| 3. One live request per item | Look up any live request on that item | **Partial unique index** on `order_item_id WHERE status IN (open, in_review, approved) AND deleted_at IS NULL` | `409 DUPLICATE_LIVE_REQUEST` with the existing reference |
| 4. Locked once decided | `isEditable()` checked after locking the row | n/a | `409 REQUEST_LOCKED` |
| 5. Removal | `isRemovable()`, then `deleted_at = now()` | `CHECK`: `deleted_at` may only be set on open/rejected rows | `409 REMOVAL_NOT_ALLOWED`; a removed request is `404` |
| Notes never change | No update/delete endpoint exists | **Trigger** rejects `UPDATE`/`DELETE` on `return_notes` | (no endpoint) |

**Concurrency.** Every mutation runs in a transaction that starts with `SELECT … FOR UPDATE` on
the request row, so two agents acting on the same request at once are serialised: the second sees
the first one's result and is refused if its action is no longer legal. For rule 3, two
*creates* for the same item lock nothing in common, so the partial unique index decides. The
loser's unique violation is translated to the same `409 DUPLICATE_LIVE_REQUEST`, not a 500. There
is a test that fires two creates at once and expects exactly one `201` and one `409`.

**Why the transition graph is not also a trigger:** it would be a second copy of the transition
table, in PL/pgSQL, that has to be kept in sync with `domain.ts`. The brief asks for validation
logic not to be duplicated. The constraints I did put in the database are invariants about a
single row, not a copy of workflow logic.

**Order of checks for a transition:** the payload's shape (400/422) → the request exists (404) →
the move is legal from its current state (409) → the approval has a valid resolution (422) → the
refund does not exceed what was paid (422). So "Open → Approved" is reported as an illegal
transition, not as "missing resolution", because that is what is actually wrong.

---

## API

All endpoints are JSON. Successful responses wrap their payload in `data`. Lists add `meta`.

| Method & path | Purpose | Success |
| --- | --- | --- |
| `GET /api/returns` | Search / filter / sort / page the desk | `200 { data: ReturnSummary[], meta }` |
| `POST /api/returns` | Raise a request | `201 { data: ReturnDetail }` + `Location` |
| `GET /api/returns/:reference` | One request with notes and status history | `200 { data: ReturnDetail }` |
| `PATCH /api/returns/:reference` | Correct customer/item details (undecided only) | `200 { data: ReturnDetail }` |
| `DELETE /api/returns/:reference` | Take off the desk (soft delete; open/rejected only) | `204` |
| `POST /api/returns/:reference/transitions` | Change status | `200 { data: ReturnDetail }` |
| `GET /api/returns/:reference/notes` | Notes, oldest first | `200 { data: Note[] }` |
| `POST /api/returns/:reference/notes` | Add a note | `201 { data: Note }` |
| `GET /api/orders?q=` | Find orders by number or customer (max 10) | `200 { data: OrderSummary[] }` |
| `GET /api/orders/:orderNumber` | Order, customer and items (with any live return per item) | `200 { data: OrderDetail }` |

**List query:** `q` (searches reference, customer name, customer email and order number),
`status` and `reason` (comma-separated, e.g. `status=open,in_review`), `sort` (`createdAt`,
`updatedAt`, `reference`, `customerName`, `status`), `dir` (`asc`|`desc`), `page`, `pageSize`
(max 100). All of it becomes one SQL query with `WHERE … ORDER BY … LIMIT … OFFSET`, plus a
`COUNT(*)` with the same `WHERE`. The sort column comes from a whitelist, never from string
concatenation. `id` is a tie-breaker, so paging is stable. LIKE wildcards in the search term are
escaped.

**Examples**

```bash
curl -X POST localhost:3000/api/returns -H 'content-type: application/json' -d '{
  "orderNumber": "ORD-10036", "sku": "WRIST-REST-KB", "quantity": 1, "reason": "damaged",
  "customer": { "name": "Pooja Desai", "email": "pooja.desai@example.com", "phone": null } }'

curl -X POST localhost:3000/api/returns/RD-000001/transitions -H 'content-type: application/json' \
  -d '{ "to": "in_review" }'

curl -X POST localhost:3000/api/returns/RD-000002/transitions -H 'content-type: application/json' \
  -d '{ "to": "approved", "resolution": "refund", "refundAmount": 1499.5 }'
```

### Errors

Every error, from every endpoint (including unknown `/api/*` paths), has the same shape:

```json
{
  "error": {
    "code": "INVALID_TRANSITION",
    "message": "Cannot move RD-000001 from Open to Completed. Allowed next: In Review.",
    "details": { "from": "open", "to": "completed", "allowed": ["in_review"] }
  }
}
```

`code` is stable and meant for programs. `message` is written to be shown to an agent.
Validation errors list every bad field in `details.issues: [{ path, message }]`.

| Status | Code(s) | Meaning |
| --- | --- | --- |
| 400 | `INVALID_JSON`, `INVALID_QUERY` | The request could not be understood |
| 404 | `NOT_FOUND` | No such request on the desk (including removed ones), order or endpoint |
| 405 | (Next.js default, empty body) | Method not supported on that path |
| 409 | `INVALID_TRANSITION`, `DUPLICATE_LIVE_REQUEST`, `REQUEST_LOCKED`, `REMOVAL_NOT_ALLOWED` | Valid request, but the resource's current state forbids it |
| 422 | `VALIDATION_FAILED`, `ORDER_ITEM_NOT_FOUND`, `QUANTITY_EXCEEDS_ORDERED`, `REFUND_EXCEEDS_ITEM_VALUE` | Well-formed, but the content breaks a rule |
| 500 | `INTERNAL_ERROR` | Genuinely unexpected; logged on the server, details not leaked |

Why 409 vs 422: 409 means "this would be fine for a request in a different state" (retrying after
the state changes could succeed). 422 means "this payload is wrong regardless of state". An order
item that does not exist is 422, not 404, because the URL resource exists and it is the body that
refers to something missing.

---

## Frontend

- **Desk list** (`/returns`): the URL query string is the state, so filters survive reloads, can
  be shared, and work with Back. It is forwarded unchanged to `GET /api/returns`. Search is
  debounced (350 ms) and an in-flight request is aborted when a newer one starts, so a slow
  response can never overwrite a fresh one. While a new page loads, the previous results stay
  visible (dimmed). Status is a coloured badge *with* a text label. There are explicit loading,
  empty ("No return requests match" + Clear filters) and error (message + Try again) states.
  It shows a table from `md` up and cards below.
- **Request detail** (`/returns/RD-…`): details, notes (oldest first), status history. **Action
  buttons are rendered from `allowedActions` returned by the API**, so the UI never re-derives the
  rules. Approve opens a dialog asking for a resolution, and for a refund an amount (with the
  maximum shown). Reject, Complete and Remove ask for confirmation. Any refusal is shown with the
  server's message. On a 409/404 the request is also reloaded, so the buttons match its real state.
- **Raise a request** (`/returns/new`): find the order (debounced search by number, name or
  email) → pick the item (items with a live return are shown disabled with that return's reference)
  → quantity, reason → customer contact (prefilled, editable).
- **Forms validate with the same Zod schemas as the API** (`src/lib/validation.ts`) for instant
  feedback. The server re-validates, and its field errors are mapped back onto the inputs.
- **Responsive:** checked at 375 px wide with no horizontal overflow on any page.

---

## Design decisions (and what I did not choose)

- **Next.js route handlers instead of a separate Express service:** one codebase, one deploy,
  shared types. The HTTP layer is thin (`withErrorHandling`, `readJson`, `parseQuery`), and all
  logic sits in `src/server/*-service.ts`, so moving to Express later would only mean rewriting the
  route files.
- **Drizzle over Prisma or raw SQL:** queries stay close to SQL and are readable in review, the
  schema expresses enums, CHECKs, partial and GIN indexes, and migrations are plain `.sql` files
  in the repo. Raw SQL would also be defensible but loses type-checking of columns. Prisma cannot
  express partial unique indexes or CHECK constraints in its schema.
- **Status changes are a separate action resource** (`POST …/transitions`), not a `status`
  field on `PATCH`. A transition has its own payload (resolution, refund amount), its own rules and
  its own audit record. Keeping it apart lets `PATCH` mean exactly "correct the details", which
  makes rule 4 easy to state and to enforce. `PATCH` with `status` is rejected as an unknown field.
- **The reference is the public identifier** in URLs. It is what agents say on the phone, and
  using it keeps sequential database IDs out of the API.
- **Two queries (page + count) instead of `count(*) OVER()`:** the window function returns no
  total when the requested page is past the end. Two simple queries sharing one `WHERE` are
  easier to read.
- **Offset pagination, not keyset:** the desk needs "page 3 of 7" and arbitrary sort columns.
  At this scale, offset is the simpler correct choice. Keyset would be the next step for very large
  tables.
- **Client-side fetching for pages (calling our own API) instead of server components that query
  the database directly:** the browser goes through exactly the same validation and rules as an
  external client, and error handling has one path.
- **A status history table** (`return_status_changes`), written in the same transaction as each
  transition, so "who moved what when" is never lost. It is shown on the detail page.

---

## Assumptions about gaps in the brief

1. **Rejected is reachable only from In Review.** In the brief's diagram, the `→ Rejected` branch
   sits under the step after In Review, and rejecting is the alternative outcome of a review.
   Open → Rejected and Approved → Rejected are refused.
2. **"Not yet decided" = Open or In Review.** That is exactly when details can be corrected.
3. **"Customer and item details"** = customer name/email/phone, the item (another item on the same
   order, or a different order), quantity and reason. Status, resolution and refund change only
   through transitions. Notes are always allowed.
4. **The quantity cannot exceed the quantity ordered**, and **a refund cannot exceed what was paid
   for the returned units** (unit price × quantity). The brief only requires "> 0", but refunding
   more than was paid is never correct.
5. **A removed request does not block a new one for the same item.** It is off the desk, so it is
   not "live". (Removal is only possible from Open or Rejected.)
6. **A removed request is 404 everywhere**, including adding notes to it, since it "can no longer
   be fetched". It stays in the database with `deleted_at` set. There is no restore (not requested).
7. **No authentication.** The brief describes a single agent desk. Note authors type their name
   (remembered in the browser for convenience; the notes themselves are stored in Postgres).
8. **Orders, customers and items belong to the store**, so ReturnDesk reads them but does not
   manage them. They come from the seed.
9. **One currency (INR)** for display.
10. **Search is a case-insensitive substring match**; order numbers, SKUs and references are
    accepted in any case.

---

## Status: what is done, what is not

**Done and tested**

- Everything in "What ReturnDesk Must Do", and all five business rules, enforced on the server
  (and by the database where they are invariants).
- 39 integration tests (`npm test`) that call the real route handlers against a real Postgres.
  They cover the full 5×5 transition matrix, every refusal path of each rule, the concurrent-create
  race, soft delete (gone from the API but still in the table), the append-only trigger, and
  combined search/filter/sort/paging.
- Seed script, migrations from an empty database, `.env.example`.

**Not done / would do next**

- **Authentication and real agent identity.** Note authors are free text today.
- **Restore a removed request**, and an admin view of removed requests.
- **Frontend tests** (component tests for the forms, a Playwright smoke test of the main flows).
  The backend is covered; the UI was checked by hand in the browser, including at 375 px.
- **JSON bodies for 405 responses.** Unsupported methods currently get Next.js's default empty 405.
- **Optimistic concurrency for edits** (`If-Match`/version column). Today the row lock serialises
  writes, but two agents editing the same details overwrite each other last-write-wins.
- **Keyset pagination and a CI pipeline** (lint, typecheck, tests on every push).

---

## Time spent

_Roughly N hours_ (fill in before submitting).
