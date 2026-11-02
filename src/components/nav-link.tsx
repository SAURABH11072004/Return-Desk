"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** A nav link that highlights itself for its section (href and anything below it, minus `exclude`). */
export function NavLink({ href, exclude, className, children }: { href: string; exclude?: string; className: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = (pathname === href || pathname.startsWith(`${href}/`)) && pathname !== exclude;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${className} ${active ? "bg-surface text-ink shadow-card ring-1 ring-line" : "text-muted hover:text-ink"}`}
    >
      {children}
    </Link>
  );
}
