import { Compass } from "lucide-react";
import Link from "next/link";
import { button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-10">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="There is nothing at this address."
        action={
          <Link href="/returns" className={button.primary}>
            Back to returns
          </Link>
        }
      />
    </div>
  );
}
