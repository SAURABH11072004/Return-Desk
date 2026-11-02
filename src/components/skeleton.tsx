/** Shimmering placeholder. Size it with className so loading screens mirror the real layout. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}
