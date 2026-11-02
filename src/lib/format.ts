/** Assumption: the store sells in a single currency (INR). */
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });
const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

export const formatMoney = (amount: string | number) => money.format(Number(amount));
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatDate = (iso: string) => date.format(new Date(iso));
