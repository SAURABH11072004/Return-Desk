import type { Metadata } from "next";
import { Suspense } from "react";
import { Spinner } from "@/components/spinner";
import { ReturnDetailView } from "./return-detail";

export const metadata: Metadata = { title: "Return request" };

export default function ReturnPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ReturnDetailView />
    </Suspense>
  );
}
