import type { ReturnStatus } from "@/lib/domain";
import { STATUS_META } from "@/components/status-meta";

/** A small tinted pill with a dot and the label: readable at a glance, never colour alone. */
export function StatusBadge({ status, size = "sm" }: { status: ReturnStatus; size?: "sm" | "md" }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-colors duration-200 ${meta.pill} ${
        size === "md" ? "px-2.5 py-1 text-[13px]" : "px-2 py-0.5 text-xs"
      }`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}
