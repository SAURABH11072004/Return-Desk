import { BadgeCheck, CircleX, Gift, Inbox, PackageCheck, RefreshCw, ScanSearch, Wallet, type LucideIcon } from "lucide-react";
import { STATUS_LABELS, type Resolution, type ReturnStatus } from "@/lib/domain";

/** How each status looks. Presentation only: which moves are legal lives in lib/domain.ts. */
export const STATUS_META: Record<
  ReturnStatus,
  { label: string; description: string; icon: LucideIcon; pill: string; dot: string; text: string }
> = {
  open: { label: STATUS_LABELS.open, description: "New request received", icon: Inbox, pill: "bg-open-bg text-open-fg", dot: "bg-open-dot", text: "text-open-fg" },
  in_review: { label: STATUS_LABELS.in_review, description: "Being evaluated", icon: ScanSearch, pill: "bg-review-bg text-review-fg", dot: "bg-review-dot", text: "text-review-fg" },
  approved: { label: STATUS_LABELS.approved, description: "Resolution selected", icon: BadgeCheck, pill: "bg-approved-bg text-approved-fg", dot: "bg-approved-dot", text: "text-approved-fg" },
  rejected: { label: STATUS_LABELS.rejected, description: "Request declined", icon: CircleX, pill: "bg-rejected-bg text-rejected-fg", dot: "bg-rejected-dot", text: "text-rejected-fg" },
  completed: { label: STATUS_LABELS.completed, description: "Return resolved", icon: PackageCheck, pill: "bg-completed-bg text-completed-fg", dot: "bg-completed-dot", text: "text-completed-fg" },
};

export const RESOLUTION_META: Record<Resolution, { icon: LucideIcon; description: string }> = {
  refund: { icon: Wallet, description: "Money back for the returned units" },
  replacement: { icon: RefreshCw, description: "Send the same item again" },
  store_credit: { icon: Gift, description: "Credit to spend on a future order" },
};
