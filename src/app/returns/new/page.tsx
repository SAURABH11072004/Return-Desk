import type { Metadata } from "next";
import Link from "next/link";
import { NewReturnForm } from "./new-return-form";

export const metadata: Metadata = { title: "New return request" };

export default function NewReturnPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Link href="/returns" className="text-sm text-indigo-700 hover:underline">
          ← All requests
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Raise a return request</h1>
        <p className="text-sm text-slate-600">Find the order, choose the item, and record why it is coming back.</p>
      </div>
      <NewReturnForm />
    </div>
  );
}
