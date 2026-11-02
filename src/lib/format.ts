/** Assumption: the store sells in a single currency (INR). */
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });
const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });
const time = new Intl.DateTimeFormat("en-IN", { timeStyle: "short" });
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export const formatMoney = (amount: string | number) => money.format(Number(amount));
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatDate = (iso: string) => date.format(new Date(iso));
export const formatTime = (iso: string) => time.format(new Date(iso));

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "2 hours ago", "yesterday", "just now". */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const seconds = (new Date(iso).getTime() - now) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}
