// Expected invoices for the next 7 days (`App Upcoming`, written by the Apps Script in Julie's account from her
// calendar; codes only, event titles never leave the script). Every cell is plain text. Times are Pacific wall
// times with their offset ("2026-11-17T18:00-08:00"), so the date and clock are read straight from the string.
// Tapping Create invoice appends [Key, Fingerprint, DRAFT_VISIT, Who, When] to App Send; the script re-checks the
// row against the calendar and drafts the invoice. The list works with names off (codes only).
import { text, toNumber, type Grid } from "./parse.ts";

export const UPCOMING_TAB = "App Upcoming";
export const UPCOMING_HEAD = ["Key", "Code", "Billing", "Start", "End", "Hours", "Visits", "Amount", "Invoice date", "Ready at",
  "State", "Number", "Note", "Fingerprint", "Published"] as const;

export const UP_STATES = ["UPCOMING", "READY", "WAVE", "DRAFTED", "SENT", "ISSUED", "PAID", "UNLINKED"] as const;
export type UpState = (typeof UP_STATES)[number];

export interface UpcomingRow {
  key: string; code: string; billing: string;
  start: string; end: string; // Pacific, with offset
  hours: number | null; visits: number | null; amount: number | null;
  invoiceDate: string; readyAt: string; state: UpState; number: string; note: string; fingerprint: string; published: string;
}

const CODE_RE = /^Customer [A-Z0-9]{1,3}$/;

/** Rows by header name. Unknown states and rows that are not shaped like codes are dropped (UNLINKED has no code). */
export function parseUpcoming(grid: Grid): UpcomingRow[] {
  if (!grid || grid.length < 2) return [];
  const head = (grid[0] ?? []).map(text);
  const at = (r: unknown[], h: string) => { const i = head.indexOf(h); return i < 0 ? "" : text(r[i]); };
  const out: UpcomingRow[] = [];
  for (const r of grid.slice(1)) {
    if (!Array.isArray(r)) continue;
    const state = at(r, "State").toUpperCase() as UpState;
    if (!UP_STATES.includes(state)) continue;
    const code = at(r, "Code");
    if (state !== "UNLINKED" && !CODE_RE.test(code)) continue;
    out.push({
      key: at(r, "Key"), code: state === "UNLINKED" ? "" : code, billing: at(r, "Billing").toLowerCase(),
      start: at(r, "Start"), end: at(r, "End"),
      hours: toNumber(at(r, "Hours")), visits: toNumber(at(r, "Visits")), amount: toNumber(at(r, "Amount")),
      invoiceDate: at(r, "Invoice date").slice(0, 10), readyAt: at(r, "Ready at"), state, number: at(r, "Number"),
      note: at(r, "Note"), fingerprint: at(r, "Fingerprint"), published: at(r, "Published"),
    });
  }
  return out;
}

/** Only a READY row (visit over, not billed, after the start date) with its key and fingerprint can be created. */
export const canCreate = (r: UpcomingRow): boolean => r.state === "READY" && !!r.key && !!r.fingerprint;

export const isMonthly = (r: UpcomingRow): boolean => r.billing === "monthly";

/** Today's date in Pacific time (the practice's calendar), YYYY-MM-DD. */
export function pacificToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(Date.parse(iso + "T00:00:00Z") + n * 86_400_000);
  return d.toISOString().slice(0, 10);
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** "Tue 11/3" for 2026-11-03. */
export function dayShort(iso: string): string {
  const t = Date.parse(iso.slice(0, 10) + "T00:00:00Z");
  if (Number.isNaN(t)) return iso;
  const d = new Date(t);
  return `${DOW[d.getUTCDay()]} ${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

/** "11/30" from an ISO date or datetime. */
export function md(iso: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[1])}/${Number(m[2])}` : iso;
}

function clock(iso: string): { h: number; m: number } | null {
  const x = /T(\d{2}):(\d{2})/.exec(iso);
  return x ? { h: Number(x[1]), m: Number(x[2]) } : null;
}
const hm = (c: { h: number; m: number }) => `${c.h % 12 === 0 ? 12 : c.h % 12}:${String(c.m).padStart(2, "0")}`;

/** Visit time as read on the calendar: "9:00-10:30" in the morning, "6:00-7:00 pm" later, "11:30 am-1:00 pm" across noon. */
export function timeRange(start: string, end: string): string {
  const a = clock(start), b = clock(end);
  if (!a) return "";
  if (!b) return hm(a) + (a.h >= 12 ? " pm" : "");
  const pa = a.h >= 12, pb = b.h >= 12;
  if (!pa && !pb) return `${hm(a)}-${hm(b)}`;
  if (pa && pb) return `${hm(a)}-${hm(b)} pm`;
  return `${hm(a)} ${pa ? "pm" : "am"}-${hm(b)} ${pb ? "pm" : "am"}`;
}

const num = (n: number | null) => (n === null ? "?" : String(Math.round(n * 100) / 100));
const usd = (n: number | null) => (n === null ? "?" : n.toLocaleString("en-US", { style: "currency", currency: "USD" }).replace(/\.00$/, ""));

export const BILLING_LABEL: Record<string, string> = { per_visit: "per visit", monthly: "monthly", at_visit: "at the visit", none: "no email" };
export const billingLabel = (b: string): string => BILLING_LABEL[b] ?? (b || "per visit");

/** The script says "No visit note yet" (or "2 without a visit note yet" for a month): the confirm sheet warns. */
export const missingNote = (r: UpcomingRow): boolean => /no visit note yet|without a visit note/i.test(r.note);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function monthName(iso: string): string {
  const m = /^\d{4}-(\d{2})/.exec(iso);
  return m ? MONTHS[Number(m[1]) - 1] : iso;
}

/** The question on the confirm sheet: "Bill Tue 11/3, 9:00-10:30, 1.5 h, $200?" or "Bill November: 5 visits, 7.5 h, $1,687.50?". */
export function confirmText(r: UpcomingRow): string {
  if (isMonthly(r)) {
    return `Bill ${monthName(r.invoiceDate || r.start)}: ${num(r.visits)} visit${r.visits === 1 ? "" : "s"}, ${num(r.hours)} h, ${usd(r.amount)}?`;
  }
  const t = timeRange(r.start, r.end);
  return `Bill ${dayShort(r.start)}${t ? ", " + t : ""}, ${num(r.hours)} h, ${usd(r.amount)}?`;
}

/** Monthly rows: "3 visits, 4.5 h so far, $1,012.50". */
export function soFar(r: UpcomingRow): string {
  return `${num(r.visits)} visit${r.visits === 1 ? "" : "s"}, ${num(r.hours)} h, ${usd(r.amount)} so far`;
}

/** Why the Create button is not available (empty when it is). */
export function blockedReason(r: UpcomingRow): string {
  switch (r.state) {
    case "READY": return canCreate(r) ? "" : "missing its key; tap Refresh";
    case "UPCOMING": return isMonthly(r) ? `month not over yet; ready ${md(r.readyAt || r.end)}` : "visit not over yet";
    case "WAVE": return "bill in Wave";
    case "DRAFTED": return r.number ? `invoice ${r.number} drafted` : "invoice drafted";
    case "SENT": case "ISSUED": case "PAID": return `invoice ${r.number || "?"} ${r.state.toLowerCase()}`;
    default: return "";
  }
}

export interface DayGroup { key: string; label: string; rows: UpcomingRow[] }
export interface TodoList { groups: DayGroup[]; unlinked: number; readyCount: number }

/**
 * The To do list: visits over but not yet billed come first ("Not billed yet"), then one group per day from today
 * for 7 days (only days with visits), then the monthly customers. Finished rows (sent, issued, paid) from before
 * today are left out (they are under Awaiting payment / Recently paid), as are WAVE rows from before today and
 * anything after the 7 days. UNLINKED rows become a count.
 */
export function todoList(rows: UpcomingRow[], today: string, days = 7): TodoList {
  const unlinked = rows.filter((r) => r.state === "UNLINKED").reduce((a, r) => a + (r.visits ?? 1), 0);
  const live = rows.filter((r) => r.state !== "UNLINKED");
  const dateOf = (r: UpcomingRow) => (r.start || r.invoiceDate).slice(0, 10);
  const byStart = (a: UpcomingRow, b: UpcomingRow) => a.start.localeCompare(b.start) || a.code.localeCompare(b.code);
  const open = (r: UpcomingRow) => r.state === "READY" || r.state === "DRAFTED" || r.state === "UPCOMING";

  const visits = live.filter((r) => !isMonthly(r));
  const earlier = visits.filter((r) => dateOf(r) < today && open(r)).sort(byStart);
  const groups: DayGroup[] = [];
  if (earlier.length) groups.push({ key: "earlier", label: "Visit over, not sent yet", rows: earlier });
  for (let i = 0; i < days; i++) {
    const d = addDays(today, i);
    const rs = visits.filter((r) => dateOf(r) === d).sort(byStart);
    if (rs.length) groups.push({ key: d, label: (i === 0 ? "Today, " : i === 1 ? "Tomorrow, " : "") + dayShort(d), rows: rs });
  }
  const month = today.slice(0, 7);
  // This month's rows in any state; an earlier month only while it still needs billing or sending.
  const monthly = live.filter((r) => isMonthly(r) && ((r.invoiceDate || dateOf(r)).slice(0, 7) === month || open(r)))
    .sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate) || a.code.localeCompare(b.code));
  if (monthly.length) groups.push({ key: "monthly", label: "Monthly, billed at month end", rows: monthly });
  return { groups, unlinked, readyCount: live.filter((r) => r.state === "READY").length };
}

/** The UNLINKED line: "2 calendar events not linked to a customer". */
export function unlinkedLine(n: number): string {
  return n <= 0 ? "" : `${n} calendar event${n === 1 ? "" : "s"} not linked to a customer`;
}
