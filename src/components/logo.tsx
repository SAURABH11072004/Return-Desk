import Link from "next/link";

/** Brand mark: an open parcel on an indigo tile, drawn in SVG. */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="rd-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6d68f5" />
          <stop offset="1" stopColor="#3f37c9" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#rd-mark)" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="none" stroke="white" strokeOpacity="0.18" />
      <path d="M9 13.5 16 10l7 3.5v7L16 24l-7-3.5z" fill="none" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 13.5 16 17l7-3.5M16 17v7" fill="none" stroke="white" strokeOpacity="0.7" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/returns" className="group flex items-center gap-2.5" aria-label="ReturnDesk home">
      <LogoMark className="size-8 transition-transform duration-300 group-hover:-rotate-6" />
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight text-ink">ReturnDesk</span>
        <span className="mt-1 hidden text-[11px] text-faint sm:block">Returns, simplified.</span>
      </span>
    </Link>
  );
}
