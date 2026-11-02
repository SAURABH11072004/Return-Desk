import { ArrowDown, Plus } from "lucide-react";
import Link from "next/link";
import { button } from "@/components/button";
import { HeroVisual } from "@/components/dashboard/hero-visual";

export function DashboardHeader() {
  return (
    <section className="surface relative overflow-hidden">
      <div aria-hidden className="dot-grid absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_65%)]" />
      <div aria-hidden className="absolute -right-24 -top-24 size-80 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative grid items-center gap-8 p-6 sm:p-8 lg:grid-cols-[1.15fr_1fr] lg:p-10">
        <div className="max-w-xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-text">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping-soft rounded-full bg-accent" />
              <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
            </span>
            Return operations
          </p>
          <h1 className="mt-5 text-[2.1rem] font-semibold leading-[1.08] tracking-[-0.03em] text-ink sm:text-5xl lg:text-[3.4rem]">
            Manage every return
            <span className="block bg-gradient-to-r from-accent to-[#8b5cf6] bg-clip-text text-transparent">from one place.</span>
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted sm:text-base">
            Track, review and resolve customer returns with complete visibility across your workflow.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/returns/new" className={button.primary}>
              <Plus aria-hidden className="size-4" />
              New return
            </Link>
            <a href="#queue" className={button.secondary}>
              View queue
              <ArrowDown aria-hidden className="size-4" />
            </a>
          </div>
        </div>
        <div className="hidden justify-center lg:flex">
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}
