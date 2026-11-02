import Link from "next/link";

/** Brand mark: a simple parcel on a solid blue tile. */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden>
      <rect width="28" height="28" rx="7" fill="#3157D5" />
      <path d="M8 11.5 14 8.5l6 3v6.5l-6 3-6-3z" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 11.5l6 3 6-3M14 14.5V21" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/returns" className="flex items-center gap-2" aria-label="ReturnDesk home">
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">ReturnDesk</span>
    </Link>
  );
}
