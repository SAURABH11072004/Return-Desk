import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NewReturnForm } from "./new-return-form";

export const metadata: Metadata = { title: "New return request" };

export default function NewReturnPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link href="/returns" className="inline-flex w-fit items-center gap-1 text-[13px] text-muted transition-colors hover:text-ink">
          <ArrowLeft aria-hidden className="size-3.5" /> Returns
        </Link>
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink">New return request</h1>
          <p className="mt-1 text-[15px] text-muted">Record a customer return against one of their orders.</p>
        </div>
      </div>
      <NewReturnForm />
    </div>
  );
}
