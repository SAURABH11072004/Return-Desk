import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { button } from "@/components/button";
import { Logo } from "@/components/logo";
import { NavLink } from "@/components/nav-link";

const navClass = "relative flex h-14 items-center text-sm font-medium transition-colors";

/** Server component; only the active-link highlight reads the URL, inside its own Suspense boundary. */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Logo />
          <nav aria-label="Main" className="hidden sm:flex">
            <Suspense
              fallback={
                <Link href="/returns" className={`${navClass} text-muted`}>
                  Returns
                </Link>
              }
            >
              <NavLink href="/returns" exclude="/returns/new" className={navClass}>
                Returns
              </NavLink>
            </Suspense>
          </nav>
        </div>
        <Link href="/returns/new" className={button.primary}>
          <Plus aria-hidden className="size-4" />
          New return
        </Link>
      </div>
    </header>
  );
}
