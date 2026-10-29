// Pure parser and helpers for the `App Deadlines` tab published by CFO/ncpt_books (compliance.py).
// Codes and compliance items only, no patient data. Tolerant of dates and numbers arriving as
// text (ISO or M/D/YYYY, "12" or 12) or as Sheets serial numbers.
import { daysBetween, text, toNumber, type Grid } from "./parse.ts";

export const DEADLINES_TAB = "App Deadlines";

export type DeadlineState = "done" | "open" | "blocked" | "verify" | "undated" | "exempt";
export type Band = "overdue" | "soon" | "month" | "later" | "done" | "blocked" | "none";

export interface Deadline {
  id: string;
  title: string;
  domain: string;
  kind: string;
  period: string;
  due: string; // ISO date, "" when undated
  rawDue: string; // ISO date before a weekend/holiday roll, "" when unknown
  rolled: boolean;
  daysLeft: number | null;
  state: DeadlineState;
  blocker: string;
  method: string;
  level: string;
  verify: string;
  bench: string;
  note: string;
}

const STATES: readonly DeadlineState[] = ["done", "open", "blocked", "verify", "undated", "exempt"];

// ISO (also with a time part), M/D/YYYY, or a Sheets serial day number -> ISO; "" when it is not a date.
export function parseDate(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v > 20000 && v < 80000 ? new Date(Math.round((v - 25569) * 86_400_000)).toISOString().slice(0, 10) : "";
  }
  const s = text(v);
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  const m = iso ? [iso[1], iso[2], iso[3]] : us ? [us[3], us[1], us[2]] : null;
  if (!m) return "";
  const out = `${m[0]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return Number.isNaN(Date.parse(out + "T00:00:00Z")) || new Date(out + "T00:00:00Z").toISOString().slice(0, 10) !== out ? "" : out;
}

const truthy = (v: unknown) => /^(y|yes|true|1|rolled|x)/i.test(text(v));

// `today` (ISO) recomputes days left from the due date, so the list stays right between publishes;
// without it the published number is used.
export function parseDeadlines(grid: Grid, today?: string): Deadline[] {
  const out: Deadline[] = [];
  for (const r of grid.slice(1)) {
    if (!Array.isArray(r) || text(r[0]) === "" || text(r[1]) === "") continue;
    const due = parseDate(r[5]);
    const published = toNumber(r[8]);
    const computed = due && today ? daysBetween(today, due) : null;
    const st = text(r[9]).toLowerCase() as DeadlineState;
    out.push({
      id: text(r[0]), title: text(r[1]), domain: text(r[2]), kind: text(r[3]), period: text(r[4]),
      due, rawDue: parseDate(r[6]), rolled: truthy(r[7]),
      daysLeft: due ? (computed ?? published) : null,
      state: STATES.includes(st) ? st : due ? "open" : "undated",
      blocker: text(r[10]), method: text(r[11]), level: text(r[12]), verify: text(r[13]), bench: text(r[14]), note: text(r[15]),
    });
  }
  return out;
}

// overdue (< 0 days), soon (<= 7), month (<= 30), later (<= 90); done and blocked keep their own band;
// no date, exempt, or more than 90 days out is "none".
export function band(daysLeft: number | null, state: DeadlineState | string): Band {
  if (state === "done") return "done";
  if (state === "blocked") return "blocked";
  if (state === "exempt" || state === "undated" || daysLeft === null) return "none";
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 7) return "soon";
  if (daysLeft <= 30) return "month";
  if (daysLeft <= 90) return "later";
  return "none";
}

// Soonest dated item that still needs doing (open, verify or blocked); an overdue one wins.
export function nextDeadline(rows: Deadline[]): Deadline | null {
  const todo = rows.filter((d) => d.daysLeft !== null && (d.state === "open" || d.state === "verify" || d.state === "blocked"));
  todo.sort((a, b) => (a.daysLeft as number) - (b.daysLeft as number) || a.title.localeCompare(b.title));
  return todo[0] ?? null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const utc = (iso: string) => new Date(iso + "T00:00:00Z");

// "Mon, Nov 16"
export function dayLabel(iso: string): string {
  const d = utc(iso);
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

// Monday of the week containing `iso`.
export function weekStart(iso: string): string {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// "Week of Nov 16"
export function weekLabel(startIso: string): string {
  const d = utc(startIso);
  return `Week of ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function daysLabel(d: Deadline): string {
  if (d.state === "done") return "done";
  if (d.daysLeft === null) return d.state;
  if (d.daysLeft < 0) return `${-d.daysLeft}d overdue`;
  if (d.daysLeft === 0) return "today";
  return `${d.daysLeft}d`;
}

export interface DeadlineGroups {
  overdue: Deadline[]; // open, verify or blocked, past due
  weeks: { start: string; items: Deadline[] }[]; // due today through 90 days out, by Monday
  later: Deadline[]; // dated, more than 90 days out
  verify: Deadline[]; // undated, or to verify with no date inside the 90 days
  exempt: Deadline[];
  doneEarlier: number; // done items already past, hidden
}

// Undated rows (blank due) sort last.
const byDue = (a: Deadline, b: Deadline) => (a.due || "9999").localeCompare(b.due || "9999") || a.title.localeCompare(b.title);

export function groupDeadlines(rows: Deadline[]): DeadlineGroups {
  const g: DeadlineGroups = { overdue: [], weeks: [], later: [], verify: [], exempt: [], doneEarlier: 0 };
  const weeks = new Map<string, Deadline[]>();
  for (const d of [...rows].sort(byDue)) {
    if (d.state === "exempt") { g.exempt.push(d); continue; }
    if (d.state === "undated" || d.daysLeft === null) { g.verify.push(d); continue; }
    if (d.daysLeft < 0) {
      if (d.state === "done") g.doneEarlier++; else g.overdue.push(d);
    } else if (d.daysLeft <= 90) {
      const k = weekStart(d.due);
      weeks.set(k, [...(weeks.get(k) ?? []), d]);
    } else if (d.state === "verify") g.verify.push(d);
    else g.later.push(d);
  }
  g.weeks = [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([start, items]) => ({ start, items }));
  return g;
}
