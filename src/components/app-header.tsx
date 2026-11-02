import { LayoutList, Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { button } from "@/components/button";
import { Logo } from "@/components/logo";
import { NavLink } from "@/components/nav-link";

const navClass = "inline-flex h-8 items-center gap-2 rounded-lg px-3 text-[13px] font-medium transition-colors";

/** Server component; only the active-link highlight reads the URL, inside its own Suspense boundary. */
export function AppHeader() {
  const returnsLabel = (
    <>
      <LayoutList aria-hidden className="size-4" />
      Returns
    </>
  );
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
            <Suspense
              fallback={
                <Link href="/returns" className={`${navClass} text-muted`}>
                  {returnsLabel}
                </Link>
              }
            >
              <NavLink href="/returns" exclude="/returns/new" className={navClass}>
                {returnsLabel}
              </NavLink>
            </Suspense>
          </nav>
        </div>
        <Link href="/returns/new" className={`${button.primary} h-9 px-3.5`}>
          <Plus aria-hidden className="size-4" />
          <span>
            New<span className="hidden sm:inline"> return</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
