import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

function createDb(url: string) {
  // prepare: false keeps us compatible with transaction-mode poolers (Neon/Supabase pooled URLs).
  const client = postgres(url, { prepare: false, max: 5 });
  return { db: drizzle(client, { schema }), client };
}

type DbHandle = ReturnType<typeof createDb>;
export type Db = DbHandle["db"];
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

// Reuse one pool across hot reloads in development and across invocations of a warm serverless instance.
const globalForDb = globalThis as unknown as { returnDeskDb?: DbHandle };

function handle(): DbHandle {
  if (!globalForDb.returnDeskDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
    globalForDb.returnDeskDb = createDb(url);
  }
  return globalForDb.returnDeskDb;
}

/** Created lazily so importing this module (e.g. during `next build`) never needs a database. */
export function getDb(): Db {
  return handle().db;
}

export async function closeDb(): Promise<void> {
  await globalForDb.returnDeskDb?.client.end();
  globalForDb.returnDeskDb = undefined;
}
