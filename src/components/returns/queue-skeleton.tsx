import { Skeleton } from "@/components/skeleton";

/** Mirrors the real table (desktop) and cards (mobile) so nothing jumps when data arrives. */
export function QueueSkeleton() {
  return (
    <div aria-hidden>
      <div className="surface hidden overflow-hidden lg:block">
        <div className="h-10 border-b border-line bg-surface-2" />
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-6 border-b border-line px-5 py-4 last:border-0">
            <Skeleton className="h-4 w-20" />
            <div className="flex w-40 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-36" />
            </div>
            <div className="flex w-44 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="ml-auto h-3.5 w-20" />
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="surface flex flex-col gap-3 p-4">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
