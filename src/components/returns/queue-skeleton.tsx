import { Skeleton } from "@/components/skeleton";

/** Mirrors the real table (desktop) and list (mobile) so nothing jumps when data arrives. */
export function QueueSkeleton() {
  return (
    <div aria-hidden>
      <div className="hidden overflow-hidden rounded-xl border border-line bg-surface lg:block">
        <div className="h-9 border-b border-line bg-surface-2" />
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-6 border-b border-line px-4 py-3.5 last:border-0">
            <Skeleton className="h-3.5 w-20" />
            <div className="flex w-40 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-36" />
            </div>
            <div className="flex w-44 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="ml-auto h-3.5 w-20" />
          </div>
        ))}
      </div>
      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface lg:hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 px-4 py-3.5">
            <div className="flex justify-between">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
