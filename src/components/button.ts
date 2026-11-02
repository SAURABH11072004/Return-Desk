/** Button class recipes. Kept as strings so links and buttons can share them. */
const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium " +
  "transition-[background-color,box-shadow,transform,color,border-color] duration-200 ease-out " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-50 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const md = "h-10 px-4";
const sm = "h-8 px-3 text-[13px] rounded-lg";

export const button = {
  primary: `${base} ${md} bg-accent text-accent-fg shadow-accent hover:bg-accent-hover hover:-translate-y-px`,
  secondary: `${base} ${md} border border-line bg-surface text-ink shadow-card hover:border-line-strong hover:bg-surface-2`,
  ghost: `${base} ${md} text-ink-2 hover:bg-surface-3 hover:text-ink`,
  danger: `${base} ${md} border border-danger-line bg-surface text-danger-text hover:bg-danger-soft`,
  dangerSolid: `${base} ${md} bg-danger text-white shadow-card hover:bg-danger-hover`,
  smallSecondary: `${base} ${sm} border border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink`,
  smallGhost: `${base} ${sm} text-muted hover:bg-surface-3 hover:text-ink`,
};
