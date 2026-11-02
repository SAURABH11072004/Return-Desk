import { BadgeCheck, CircleX, Gift, Inbox, PackageCheck, RefreshCw, ScanSearch, Wallet, type LucideIcon } from "lucide-react";
import { STATUS_LABELS, type Resolution, type ReturnStatus } from "@/lib/domain";

/** How each status looks. Presentation only: which moves are legal lives in lib/domain.ts. */
export const STATUS_META: Record<
  ReturnStatus,
  { label: string; description: string; icon: LucideIcon; badge: string; dot: string; text: string; soft: string; ring: string }
> = {
  open: {
    label: STATUS_LABELS.open,
    description: "New request received",
    icon: Inbox,
    badge: "bg-open-bg text-open-fg border-open-line",
    dot: "bg-open-dot",
    text: "text-open-fg",
    soft: "bg-open-bg",
    ring: "border-open-line",
  },
  in_review: {
    label: STATUS_LABELS.in_review,
    description: "Being evaluated",
    icon: ScanSearch,
    badge: "bg-review-bg text-review-fg border-review-line",
    dot: "bg-review-dot",
    text: "text-review-fg",
    soft: "bg-review-bg",
    ring: "border-review-line",
  },
  approved: {
    label: STATUS_LABELS.approved,
    description: "Resolution selected",
    icon: BadgeCheck,
    badge: "bg-approved-bg text-approved-fg border-approved-line",
    dot: "bg-approved-dot",
    text: "text-approved-fg",
    soft: "bg-approved-bg",
    ring: "border-approved-line",
  },
  rejected: {
    label: STATUS_LABELS.rejected,
    description: "Request declined",
    icon: CircleX,
    badge: "bg-rejected-bg text-rejected-fg border-rejected-line",
    dot: "bg-rejected-dot",
    text: "text-rejected-fg",
    soft: "bg-rejected-bg",
    ring: "border-rejected-line",
  },
  completed: {
    label: STATUS_LABELS.completed,
    description: "Return resolved",
    icon: PackageCheck,
    badge: "bg-completed-bg text-completed-fg border-completed-line",
    dot: "bg-completed-dot",
    text: "text-completed-fg",
    soft: "bg-completed-bg",
    ring: "border-completed-line",
  },
};

export const RESOLUTION_META: Record<Resolution, { icon: LucideIcon; description: string }> = {
  refund: { icon: Wallet, description: "Money back for the returned units" },
  replacement: { icon: RefreshCw, description: "Send the same item again" },
  store_credit: { icon: Gift, description: "Credit to spend on a future order" },
};
