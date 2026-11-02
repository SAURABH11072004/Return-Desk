import type { Metadata } from "next";
import { Suspense } from "react";
import { ReturnsDesk } from "./returns-desk";

export const metadata: Metadata = { title: "Returns" };

export default function ReturnsPage() {
  // useSearchParams needs a Suspense boundary; the desk renders its own skeletons while loading.
  return (
    <Suspense>
      <ReturnsDesk />
    </Suspense>
  );
}
