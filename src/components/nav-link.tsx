"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** A nav link that marks itself for its section (href and anything below it, minus `exclude`). */
export function NavLink({ href, exclude, className, children }: { href: string; exclude?: string; className: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = (pathname === href || pathname.startsWith(`${href}/`)) && pathname !== exclude;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${className} ${
        active ? "text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
