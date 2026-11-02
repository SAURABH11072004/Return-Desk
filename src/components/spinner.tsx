import { LoaderCircle } from "lucide-react";

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-muted">
      <LoaderCircle aria-hidden className="size-4 animate-spin text-accent" />
      {label}
    </span>
  );
}
