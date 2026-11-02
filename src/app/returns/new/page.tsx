import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NewReturnForm } from "./new-return-form";

export const metadata: Metadata = { title: "New return" };

export default function NewReturnPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Link href="/returns" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink">
          <ArrowLeft aria-hidden className="size-4" /> All returns
        </Link>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-text">Create return</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-ink sm:text-4xl">Raise a return request</h1>
          <p className="mt-2 max-w-xl text-[15px] text-muted">
            Find the order, choose the item and record why it is coming back. The desk takes it from there.
          </p>
        </div>
      </div>
      <NewReturnForm />
    </div>
  );
}
