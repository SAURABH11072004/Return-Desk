/** Button class recipes. Kept as strings so links and buttons can share them. */
const base =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-medium " +
  "transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const md = "h-9 px-3.5";
const sm = "h-8 px-2.5 text-[13px]";

export const button = {
  primary: `${base} ${md} bg-accent text-accent-fg hover:bg-accent-hover`,
  secondary: `${base} ${md} border border-line-strong bg-surface text-ink hover:bg-surface-3`,
  ghost: `${base} ${md} text-ink-2 hover:bg-surface-3 hover:text-ink`,
  danger: `${base} ${md} border border-line-strong bg-surface text-danger-text hover:border-danger-line hover:bg-danger-soft`,
  dangerSolid: `${base} ${md} bg-danger text-white hover:bg-danger-hover`,
  smallSecondary: `${base} ${sm} border border-line-strong bg-surface text-ink-2 hover:bg-surface-3 hover:text-ink`,
  smallGhost: `${base} ${sm} text-muted hover:bg-surface-3 hover:text-ink`,
};
