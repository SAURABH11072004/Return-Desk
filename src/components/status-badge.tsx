import type { ReturnStatus } from "@/lib/domain";
import { STATUS_META } from "@/components/status-meta";

/** Icon + tint + border + text label, so status reads at a glance and never relies on colour alone. */
export function StatusBadge({ status, size = "sm" }: { status: ReturnStatus; size?: "sm" | "md" }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-medium transition-colors duration-300 ${meta.badge} ${
        size === "md" ? "px-3 py-1 text-[13px]" : "px-2.5 py-0.5 text-xs"
      }`}
    >
      <Icon aria-hidden className={size === "md" ? "size-4" : "size-3.5"} strokeWidth={2.25} />
      {meta.label}
    </span>
  );
}
