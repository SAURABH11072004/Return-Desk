const base =
  "inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50";

export const button = {
  primary: `${base} bg-indigo-600 text-white hover:bg-indigo-500`,
  secondary: `${base} bg-white text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50`,
  danger: `${base} bg-white text-rose-700 ring-1 ring-inset ring-rose-300 hover:bg-rose-50`,
  dangerSolid: `${base} bg-rose-600 text-white hover:bg-rose-500`,
};
