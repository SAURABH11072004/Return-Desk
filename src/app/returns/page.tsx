import type { Metadata } from "next";
import { Suspense } from "react";
import { Spinner } from "@/components/spinner";
import { ReturnsDesk } from "./returns-desk";

export const metadata: Metadata = { title: "Return requests" };

export default function ReturnsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ReturnsDesk />
    </Suspense>
  );
}
