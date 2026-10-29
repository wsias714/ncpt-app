// "Filed" record: after Julie or Wade files something at a portal, the app appends one row to `App Filings`
// (Id and Period must match the App Deadlines row exactly). The app files nothing; this only records it so
// the deadline turns done at the next publish.
import { parseDate } from "./deadlines.ts";
import { toNumber } from "./parse.ts";
import type { Who } from "./who.ts";

export const FILINGS_TAB = "App Filings";

export interface FilingInput {
  id: string; period: string; confirmation: string; amount: string; filedOn: string; method: string; note?: string;
}

/** Problems with the form, [] when it can be saved. Mirrors ncpt_books/filings.py (confirmation required, no leading "-", ISO date). */
export function validateFiling(i: FilingInput): string[] {
  const out: string[] = [];
  const conf = i.confirmation.trim();
  if (!i.id.trim() || !i.period.trim()) out.push("Pick the deadline item this filing is for.");
  if (!conf) out.push("Enter the confirmation number.");
  else if (conf.startsWith("-")) out.push("The confirmation number cannot start with a minus sign.");
  const on = i.filedOn.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(on) || parseDate(on) !== on) out.push("Enter the filed date as YYYY-MM-DD.");
  const amt = i.amount.trim();
  if (amt && toNumber(amt) === null) out.push("The amount must be a number (leave it blank if there is none).");
  return out;
}

/** [Id, Period, Confirmation, Amount, Filed on, Method, Who, When, Note]. Amount is normalized to two decimals. */
export function filingRow(i: FilingInput, who: Who, now: Date = new Date()): string[] {
  const amt = toNumber(i.amount.trim());
  return [i.id.trim(), i.period.trim(), i.confirmation.trim(), amt === null ? "" : amt.toFixed(2), i.filedOn.trim(),
    i.method.trim(), who, now.toISOString(), (i.note ?? "").trim()];
}
