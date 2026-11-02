// Pure parsers for the app-ready tabs published by CFO/ncpt_books (publish.py). Input is the raw
// `values` grid from the Sheets API. Every parser tolerates a missing or empty tab (returns an
// empty result). Customer names are never read: only codes like "Customer V" pass through.

export type Grid = unknown[][];

export const UNLABELED = "Unlabeled";
const CODE_RE = /^Customer [A-Z0-9]{1,3}$/;

export function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  let s = v.trim();
  if (!s) return null;
  const neg = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[()$,\s-]/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = parseFloat(s);
  return neg ? -n : n;
}

export const text = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

export function customerCode(v: unknown): string {
  const s = text(v);
  return CODE_RE.test(s) ? s : UNLABELED;
}

// Accepts ISO strings, ISO datetimes, M/D/YYYY (a date cell's formatted string), or a Sheets serial day number.
export function toIsoDate(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) {
    return new Date(Math.round((v - 25569) * 86_400_000)).toISOString().slice(0, 10);
  }
  const s = text(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  return us ? `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}` : s;
}

export function daysBetween(fromIso: string, today: string): number | null {
  const a = Date.parse(fromIso + "T00:00:00Z");
  const b = Date.parse(today + "T00:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

export function money(n: number | null): string {
  if (n === null) return "n/a";
  const s = Math.abs(n).toLocaleString("en-US", { style: "currency", currency: "USD" });
  return n < 0 ? `-${s}` : s;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const dataRows = (grid: Grid): unknown[][] => grid.slice(1).filter((r) => Array.isArray(r) && r.some((c) => text(c) !== ""));

// ---- App Summary ------------------------------------------------------------------------

export interface Summary {
  built: string;
  asOf: string;
  profitMtd: number | null;
  profitLastMonth: number | null;
  profitYtd: number | null;
  netWagesYtd: number | null; // gross wages less employee taxes (take-home pay): owner income
  k401Ytd: number | null; // 401k employer contribution: counted with wages as owner income
  wagesGrossYtd: number | null;
  payrollTaxesYtd: number | null;
  matchYtd: number | null;
  payrollLiab: number | null;
  cash: number | null;
  cardOwed: number | null;
  ar: number | null;
  mileageOwed: number | null;
  mileageDue: string;
  lastClosedMonth: string;
  closeBlockers: string[]; // empty when "none"
  needsBooking: number | null;
  present: boolean;
}

export function parseSummary(grid: Grid): Summary {
  const kv = new Map<string, unknown>();
  for (const row of dataRows(grid)) kv.set(text(row[0]), row[1]);
  const n = (k: string) => toNumber(kv.get(k));
  const blockers = text(kv.get("close_blockers"));
  return {
    built: text(kv.get("built")),
    asOf: toIsoDate(kv.get("as_of")),
    profitMtd: n("profit_mtd"),
    profitLastMonth: n("profit_last_month"),
    profitYtd: n("profit_ytd"),
    netWagesYtd: n("net_wages_ytd"),
    k401Ytd: n("k401_ytd"),
    wagesGrossYtd: n("wages_gross_ytd"),
    payrollTaxesYtd: n("payroll_taxes_ytd"),
    matchYtd: n("match_ytd"),
    payrollLiab: n("payroll_liab"),
    cash: n("cash"),
    cardOwed: n("card_owed"),
    ar: n("ar"),
    mileageOwed: n("mileage_owed"),
    mileageDue: text(kv.get("mileage_due")),
    lastClosedMonth: text(kv.get("last_closed_month")),
    closeBlockers: !blockers || blockers.toLowerCase() === "none" ? [] : blockers.split(";").map((s) => s.trim()).filter(Boolean),
    needsBooking: n("needs_booking"),
    present: kv.size > 0,
  };
}

// Profit with owner pay added back (net wages + 401k contribution): the owner is paid this instead of
// distributions, so it is income too. Employer payroll taxes are a real cost and stay deducted.
export function beforeOwnerPay(profit: number | null, ownerPay: number | null): number | null {
  return profit === null || ownerPay === null ? null : round2(profit + ownerPay);
}

export function wagesTotal(s: Summary): number | null {
  const parts = [s.wagesGrossYtd, s.payrollTaxesYtd, s.matchYtd];
  return parts.every((p) => p === null) ? null : round2(parts.reduce<number>((a, p) => a + (p ?? 0), 0));
}

// ---- App Transactions + App Decisions ------------------------------------------------------

export interface Tx {
  entry: string;
  date: string;
  account: "Checking" | "Card" | string;
  amount: number;
  description: string;
  code: string; // a chart code, or IGNORE for a line kept out of the books
  category: string; // the account name, or "Ignored: <reason>"
  status: string; // booked | review | ignored
  source: string;
  locked: boolean; // entry sits in a closed month: no re-booking
  appliedTo: string; // the invoice(s) a deposit paid: "Invoice 3534 (Customer C)", "(proposed)" appended if unvalidated
}

// App Decisions account value that keeps a bank or card line out of the books (needs a reason in Note).
export const IGNORE = "IGNORE";
export const isIgnored = (tx: Tx): boolean => tx.status === "ignored" || tx.code.toUpperCase() === IGNORE;

export function parseTransactions(grid: Grid): Tx[] {
  const out: Tx[] = [];
  for (const r of dataRows(grid)) {
    const entry = text(r[0]);
    const amount = toNumber(r[3]);
    if (!entry || amount === null) continue;
    out.push({
      entry, date: toIsoDate(r[1]), account: text(r[2]), amount, description: text(r[4]),
      code: text(r[5]), category: text(r[6]), status: text(r[7]).toLowerCase(), source: text(r[8]),
      locked: text(r[9]).toLowerCase() === "yes", appliedTo: text(r[10]),
    });
  }
  return out;
}

// [Entry, Account, Note, Who, When, Status]; the app appends A:E, Python writes Status back after each build:
// applied | ignored | superseded | rejected: <why>.
export interface Decision { entry: string; account: string; note: string; who: string; when: string; status: string }

export function parseDecisions(grid: Grid): Decision[] {
  return dataRows(grid)
    .map((r) => ({ entry: text(r[0]), account: text(r[1]), note: text(r[2]), who: text(r[3]), when: text(r[4]), status: text(r[5]) }))
    .filter((d) => d.entry && d.account);
}

/** Why the latest decision for this line was not applied ("locked period"), or "" when it was not rejected. */
export function rejection(tx: Tx, latest: Map<string, Decision>): string {
  const d = latest.get(tx.entry);
  if (!d || !/^rejected/i.test(d.status)) return "";
  return d.status.replace(/^rejected:?\s*/i, "") || "rejected";
}

/** A row for App Decisions: a chart code (re-book) or IGNORE. Returns why it cannot be saved, or "". */
export function decisionProblem(account: string, note: string): string {
  if (!account) return "Choose an account";
  if (account.toUpperCase() === IGNORE && !note.trim()) return "Say why it is ignored";
  return "";
}

export interface TxChip { text: string; kind: "pend" | "review" | "ignored" | "rejected" | "" }

/**
 * The status chip on a transaction row. A rejected decision (Python could not apply it) shows why and the line keeps
 * its published state; a pending one shows the new category (or "ignore"); an ignored line shows "Ignored: <reason>".
 */
export function txChip(tx: Tx, latest: Map<string, Decision>, accountNames: Map<string, string>): TxChip {
  const rej = rejection(tx, latest);
  if (rej) return { text: `not applied: ${rej}`, kind: "rejected" };
  if (isPending(tx, latest)) {
    const acct = latest.get(tx.entry)?.account ?? "";
    return { text: `pending: ${acct.toUpperCase() === IGNORE ? "ignore" : accountNames.get(acct) ?? "new category"}`, kind: "pend" };
  }
  if (isIgnored(tx)) return { text: /^ignored/i.test(tx.category) ? tx.category : "Ignored", kind: "ignored" };
  return tx.code ? { text: tx.category, kind: "" } : { text: "Needs booking", kind: "review" };
}

// Latest row per entry wins (the tab is append-only, so later rows are newer).
export function latestDecisions(ds: Decision[]): Map<string, Decision> {
  const m = new Map<string, Decision>();
  for (const d of ds) m.set(d.entry, d);
  return m;
}

// Pending: the latest decision is not yet the published Category code (IGNORE compares case-insensitively, since
// Python accepts any case) and Python has not rejected it.
export function isPending(tx: Tx, latest: Map<string, Decision>): boolean {
  const d = latest.get(tx.entry);
  return !!d && d.account.toUpperCase() !== tx.code.toUpperCase() && !/^rejected/i.test(d.status);
}

export const needsBooking = (tx: Tx, latest: Map<string, Decision>): boolean =>
  tx.status === "review" && !isPending(tx, latest);

export interface TxFilter {
  query: string;
  account: string; // "" | Checking | Card
  month: string; // "" | YYYY-MM
  reviewOnly: boolean;
  code: string; // "" | category code
}
export const NO_FILTER: TxFilter = { query: "", account: "", month: "", reviewOnly: false, code: "" };

export function filterTransactions(txs: Tx[], f: TxFilter, latest: Map<string, Decision>, label: (t: string) => string = (t) => t): Tx[] {
  const q = f.query.trim().toLowerCase();
  return txs.filter((t) => {
    if (f.account && t.account !== f.account) return false;
    if (f.month && !t.date.startsWith(f.month)) return false;
    if (f.reviewOnly && !needsBooking(t, latest)) return false;
    if (f.code && t.code !== f.code) return false;
    if (q) {
      const hay = `${t.description} ${label(t.description)} ${t.category} ${t.code} ${t.amount.toFixed(2)}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function hasTransactionsForCode(txs: Tx[], code: string): boolean {
  return !!code && txs.some((t) => t.code === code);
}

export function txMonths(txs: Tx[]): string[] {
  return [...new Set(txs.map((t) => t.date.slice(0, 7)).filter((m) => /^\d{4}-\d{2}$/.test(m)))].sort().reverse();
}

export function txCategories(txs: Tx[]): { code: string; name: string }[] {
  const m = new Map<string, string>();
  for (const t of txs) if (t.code && !m.has(t.code)) m.set(t.code, t.code.toUpperCase() === IGNORE ? "Ignored" : t.category);
  return [...m].map(([code, name]) => ({ code, name })).sort((a, b) => a.code.localeCompare(b.code));
}

export function recentTransactions(txs: Tx[], today: string, days = 7): Tx[] {
  return txs.filter((t) => {
    const d = daysBetween(t.date, today);
    return d !== null && d >= 0 && d < days;
  });
}

// ---- App Monthly -----------------------------------------------------------------------------

export interface MonthRow {
  month: string; income: number; expense: number; netCash: number; netAccrual: number;
  cashEnd: number; arEnd: number; cardEnd: number;
  netWages: number; // take-home wages booked that month (optional trailing column)
  k401: number; // 401k employer contribution booked that month (optional trailing column)
}

export function parseMonthly(grid: Grid): MonthRow[] {
  const out: MonthRow[] = [];
  for (const r of dataRows(grid)) {
    const month = text(r[0]).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const v = (i: number) => toNumber(r[i]) ?? 0;
    out.push({ month, income: v(1), expense: v(2), netCash: v(3), netAccrual: v(4), cashEnd: v(5), arEnd: v(6), cardEnd: v(7), netWages: v(8), k401: v(9) });
  }
  return out.sort((a, b) => a.month.localeCompare(b.month));
}

// ---- App Invoices ----------------------------------------------------------------------------

// Header: Number, Code, Invoice date, Due, Total, Status, Source, Paid on, Deposit, Email draft. The last three
// were added 2026-11 (older 7-column grids still parse: no paid date, email draft unknown).
// Status is the book status: DRAFT (made, not delivered), SENT, ISSUED (handed over at the visit), PAID, VOID
// (never delivered, never posts), WRITTEN_OFF. Only SENT and ISSUED are open receivables.
export type InvoiceStatus = "DRAFT" | "SENT" | "ISSUED" | "PAID" | "VOID" | "WRITTEN_OFF";

export interface ArItem {
  number: string;
  code: string;
  invoiceDate: string;
  due: string;
  amount: number;
  status: InvoiceStatus | string;
  source: string;
  ageDays: number | null; // days since the invoice date
  paidOn: string; // latest matched deposit date (or the desk decision date for cash); "" if unpaid or unknown
  deposit: string; // like "10/2 $5,062 + 10/2 $1"
  emailDraft: boolean | null; // a Gmail draft exists (Y/N); null on an older grid without the column
}

export function parseAppInvoices(grid: Grid, today: string): ArItem[] {
  const out: ArItem[] = [];
  for (const r of dataRows(grid)) {
    const number = text(r[0]);
    const amount = toNumber(r[4]);
    if (!number || amount === null) continue;
    const invoiceDate = toIsoDate(r[2]);
    const ed = text(r[9]).toUpperCase();
    out.push({
      number, code: customerCode(r[1]), invoiceDate, due: toIsoDate(r[3]), amount,
      status: text(r[5]).toUpperCase(), source: text(r[6]), ageDays: daysBetween(invoiceDate, today),
      paidOn: toIsoDate(r[7]), deposit: text(r[8]), emailDraft: ed === "Y" ? true : ed === "N" ? false : null,
    });
  }
  return out;
}

export const isOpen = (i: ArItem): boolean => i.status === "SENT" || i.status === "ISSUED";

export interface InvoiceStats {
  outstanding: ArItem[]; // SENT or ISSUED (open receivables), oldest first: "Awaiting payment"
  outstandingTotal: number;
  overdue: ArItem[];
  oldestAgeDays: number | null;
  drafts: ArItem[]; // every DRAFT
  draftsTotal: number;
  readyToSend: ArItem[]; // DRAFT with an email draft (or unknown, on an older grid): previewed under Ready to send
  readyToSendTotal: number;
  needsAttention: ArItem[]; // DRAFT with no email draft: Mark sent / Mark issued / Void
  paid30: ArItem[]; // PAID in the last 30 days (paid date; invoice date on an older grid), newest first
  paid30Total: number;
}

export function invoiceStats(items: ArItem[], today: string): InvoiceStats {
  const sum = (xs: ArItem[]) => round2(xs.reduce((s, i) => s + i.amount, 0));
  const outstanding = items.filter(isOpen).sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1) || a.number.localeCompare(b.number));
  const overdue = outstanding.filter((i) => i.due && i.due < today);
  const drafts = items.filter((i) => i.status === "DRAFT");
  const readyToSend = drafts.filter((i) => i.emailDraft !== false);
  const paidDate = (i: ArItem) => i.paidOn || i.invoiceDate;
  const paid30 = items.filter((i) => {
    if (i.status !== "PAID") return false;
    const d = daysBetween(paidDate(i), today);
    return d !== null && d >= 0 && d <= 30;
  }).sort((a, b) => paidDate(b).localeCompare(paidDate(a)));
  return {
    outstanding, outstandingTotal: sum(outstanding), overdue,
    oldestAgeDays: outstanding.length ? outstanding[0].ageDays : null,
    drafts, draftsTotal: sum(drafts), readyToSend, readyToSendTotal: sum(readyToSend),
    needsAttention: drafts.filter((i) => i.emailDraft === false),
    paid30, paid30Total: sum(paid30),
  };
}

export function totalOpen(items: ArItem[]): number {
  return round2(items.reduce((s, i) => s + i.amount, 0));
}

// ---- Accounts --------------------------------------------------------------------------------

export interface Account { code: string; name: string; type: string; line: string }

export function parseAccounts(grid: Grid): Account[] {
  return dataRows(grid)
    .map((r) => ({ code: text(r[0]), name: text(r[1]), type: text(r[2]).toLowerCase(), line: text(r[3]) }))
    .filter((a) => a.code && a.name);
}

const TYPE_ORDER: Record<string, number> = { income: 0, expense: 1 };
// Income and expense codes first (they are what a bank line is booked to), then the rest.
export function accountPickerOrder(accts: Account[]): Account[] {
  const rank = (a: Account) => TYPE_ORDER[a.type] ?? 2;
  return [...accts].sort((a, b) => rank(a) - rank(b) || a.code.localeCompare(b.code, undefined, { numeric: true }));
}

// ---- P&L (publish.pnl_grid) --------------------------------------------------------------------
// Header: Code, Account, 1120-S, <month labels...>, YTD cash, YTD accrual. Section rows are a
// single cell ("Income" / "Expense"); "Total ..." rows have an empty code; last row is Net income.

export interface PnlRow { code: string; name: string; line: string; values: number[] }
export interface PnlSection { title: string; rows: PnlRow[]; total: number[] }
export interface Pnl {
  title: string;
  months: string[]; // labels like "Jan"; values[] has months.length + 2 entries (YTD cash, YTD accrual)
  sections: PnlSection[];
  net: number[];
}
export const EMPTY_PNL: Pnl = { title: "", months: [], sections: [], net: [] };

export function parsePnl(grid: Grid): Pnl {
  const h = grid.findIndex((r) => text(r?.[0]) === "Code" && text(r?.[1]) === "Account");
  if (h < 0) return EMPTY_PNL;
  const head = grid[h].map(text);
  const months = head.slice(3, Math.max(3, head.length - 2));
  const width = months.length + 2;
  const vals = (r: unknown[]) => Array.from({ length: width }, (_, i) => toNumber(r[3 + i]) ?? 0);
  const sections: PnlSection[] = [];
  let net: number[] = [];
  let cur: PnlSection | null = null;
  for (const r of grid.slice(h + 1)) {
    if (!Array.isArray(r) || r.every((c) => text(c) === "")) continue;
    const code = text(r[0]), name = text(r[1]);
    if (code && !name) { cur = { title: code, rows: [], total: [] }; sections.push(cur); continue; }
    if (!code && name === "Net income") { net = vals(r); continue; }
    if (!code && name.startsWith("Total") && cur) { cur.total = vals(r); continue; }
    if (code && cur) cur.rows.push({ code, name, line: text(r[2]), values: vals(r) });
  }
  return { title: text(grid[0]?.[0]), months, sections, net };
}

// ---- Time periods and year over year -------------------------------------------------------------

export type Period = "1M" | "3M" | "6M" | "12M" | "YTD";
export const PERIODS: Period[] = ["1M", "3M", "6M", "12M", "YTD"];
export const PERIOD_LABEL: Record<Period, string> = {
  "1M": "This month so far", "3M": "Last 3 full months", "6M": "Last 6 full months", "12M": "Last 12 full months", YTD: "Year to date",
};

// The windows: 3M, 6M and 12M are the last N COMPLETE months, ending the month before the as-of month (the as-of
// month is still open, and a just-started month would otherwise count as a zero). 1M is the open month to date.
// YTD is January through the as-of month to date. A past year's report passes `asOfComplete` so its last month
// (December) counts as complete.
export interface PeriodOpts { asOfComplete?: boolean }

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function addMonths(month: string, delta: number): string {
  const idx = Number(month.slice(0, 4)) * 12 + (Number(month.slice(5, 7)) - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

/** The month that is open ("so far") on the as-of date. */
export function asOfMonth(monthly: MonthRow[], asOf: string): string {
  return asOf.slice(0, 7) || monthly[monthly.length - 1]?.month || "";
}

/** A month with nothing booked in it (all five figures zero). */
export const isEmptyMonth = (r: MonthRow): boolean => !r.income && !r.expense && !r.netCash && !r.netWages && !r.k401;

const monthLabel = (m: string): string => `${MONTH_NAMES[Number(m.slice(5, 7)) - 1] ?? m} ${m.slice(0, 4)}`;
const longDate = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${MONTH_NAMES[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}` : iso;
};

export interface PeriodWindow {
  rows: MonthRow[]; // ascending; only months that have a published row
  start: string; end: string; // the calendar window actually covered ("" when empty)
  label: string; // "Aug to Oct 2026 (3 full months)"
  empty: boolean; // 1M with nothing booked yet, or no rows
}

/** Where a period starts and ends: calendar months, before they are matched to published rows. */
function calendarWindow(monthly: MonthRow[], asOf: string, p: Period, o: PeriodOpts = {}): { start: string; end: string } {
  const open = asOfMonth(monthly, asOf);
  if (!open) return { start: "", end: "" };
  if (p === "1M") return { start: open, end: open };
  if (p === "YTD") return { start: `${open.slice(0, 4)}-01`, end: open };
  const end = o.asOfComplete ? open : addMonths(open, -1);
  return { start: addMonths(end, 1 - Number(p.slice(0, -1))), end };
}

export function periodWindow(monthly: MonthRow[], asOf: string, p: Period, o: PeriodOpts = {}): PeriodWindow {
  const cal = calendarWindow(monthly, asOf, p, o);
  let rows = monthly.filter((r) => r.month >= cal.start && r.month <= cal.end);
  if (p === "1M") rows = rows.filter((r) => !isEmptyMonth(r));
  const first = rows[0]?.month ?? "", last = rows[rows.length - 1]?.month ?? "";
  if (p === "1M") {
    const open = cal.end;
    return { rows, start: open, end: open, empty: rows.length === 0, label: o.asOfComplete ? monthLabel(open) : rows.length ? "This month so far" : "Nothing booked yet this month" };
  }
  if (p === "YTD") {
    return { rows, start: cal.start, end: cal.end, empty: rows.length === 0, label: `Year to date, through ${longDate(asOf || `${cal.end}-01`)}` };
  }
  if (!rows.length) return { rows, start: "", end: "", empty: true, label: "No full months yet" };
  // Cover the months actually available: a young ledger has fewer than N full months.
  const start = first > cal.start ? first : cal.start;
  const count = Number(last.slice(0, 4)) * 12 + Number(last.slice(5, 7)) - (Number(start.slice(0, 4)) * 12 + Number(start.slice(5, 7))) + 1;
  const sameYear = start.slice(0, 4) === last.slice(0, 4);
  const span = count === 1 ? monthLabel(last)
    : sameYear ? `${MONTH_NAMES[Number(start.slice(5, 7)) - 1]} to ${monthLabel(last)}` : `${monthLabel(start)} to ${monthLabel(last)}`;
  const short = count < Number(p.slice(0, -1)) ? ` (${count} full ${count === 1 ? "month" : "months"}, fewer than ${p.slice(0, -1)} so far)` : ` (${count} full months)`;
  return { rows, start, end: last, empty: false, label: span + short };
}

// Months in the period, ascending.
export function periodMonths(monthly: MonthRow[], asOf: string, p: Period, o: PeriodOpts = {}): MonthRow[] {
  return periodWindow(monthly, asOf, p, o).rows;
}

// Trends can also look at every month published (complete months only; the open month is a partial bar).
export type TrendRange = Period | "ALL";
export const TREND_RANGES: TrendRange[] = ["3M", "6M", "YTD", "12M", "ALL"];
export function trendMonths(monthly: MonthRow[], asOf: string, r: TrendRange): MonthRow[] {
  if (r !== "ALL") return periodMonths(monthly, asOf, r);
  const open = asOfMonth(monthly, asOf);
  return monthly.filter((x) => x.month < open);
}

// What the Today chart plots for a horizon: the months of the window, oldest first, then the open month ("so
// far") when it has anything booked. 1M plots the last 6 complete months (there is no window of its own).
export interface ProfitPoint { month: string; before: number; after: number; open: boolean }

export function profitPoints(monthly: MonthRow[], asOf: string, p: Period): ProfitPoint[] {
  const open = asOfMonth(monthly, asOf);
  const complete = p === "1M" ? periodMonths(monthly, asOf, "6M")
    : p === "YTD" ? periodMonths(monthly, asOf, "YTD").filter((r) => r.month < open)
    : periodMonths(monthly, asOf, p);
  const cur = monthly.find((r) => r.month === open && !isEmptyMonth(r));
  const pt = (r: MonthRow, isOpen: boolean): ProfitPoint => ({ month: r.month, before: round2(r.netCash + r.netWages + r.k401), after: r.netCash, open: isOpen });
  return [...complete.map((r) => pt(r, false)), ...(cur ? [pt(cur, true)] : [])];
}

/** A quarterly payroll month in a short window makes single months swing: say so. */
export function payrollSwingNote(rows: MonthRow[], p: Period): string {
  const short = p === "1M" || (p === "YTD" && rows.length < 3); // 3M and up are not short by design
  return short && rows.some((r) => r.netWages > 0) ? "Payroll is paid quarterly, so single months swing; use 3M or longer." : "";
}

// Years that have monthly rows, newest first.
export function monthlyYears(monthly: MonthRow[]): string[] {
  return [...new Set(monthly.map((r) => r.month.slice(0, 4)))].sort().reverse();
}

export interface Totals {
  months: number; income: number; expense: number; net: number;
  netWages: number; k401: number; ownerPay: number; beforeOwnerPay: number;
}
export function totals(rows: MonthRow[]): Totals {
  const sum = (f: (r: MonthRow) => number) => round2(rows.reduce((a, r) => a + f(r), 0));
  const net = sum((r) => r.netCash), netWages = sum((r) => r.netWages), k401 = sum((r) => r.k401);
  const ownerPay = round2(netWages + k401);
  return { months: rows.length, income: sum((r) => r.income), expense: sum((r) => r.expense), net, netWages, k401, ownerPay, beforeOwnerPay: round2(net + ownerPay) };
}

export interface YearCompare { current: Totals; prior: Totals; priorMonths: number; currentLabel: string; priorLabel: string }

const prevYear = (month: string) => `${Number(month.slice(0, 4)) - 1}${month.slice(4)}`;

// The same months one year earlier. priorMonths counts how many of them have data (the ledger starts
// 2026-01, so there is no prior year until 2027).
export function compareYears(monthly: MonthRow[], asOf: string, p: Period, o: PeriodOpts = {}): YearCompare {
  const cur = periodMonths(monthly, asOf, p, o);
  const prior = cur.map((r) => monthly.find((x) => x.month === prevYear(r.month))).filter((r): r is MonthRow => !!r);
  const label = (rows: string[]) => (rows.length === 0 ? "" : rows.length === 1 ? rows[0] : `${rows[0]} to ${rows[rows.length - 1]}`);
  return { current: totals(cur), prior: totals(prior), priorMonths: prior.length, currentLabel: label(cur.map((r) => r.month)), priorLabel: label(cur.map((r) => prevYear(r.month))) };
}

// Owner pay for chosen months of one year (month numbers 1-12; omit for the whole year). The P&L tab only
// has gross wages, so the add-back for its columns comes from the monthly rows.
export function ownerPayInMonths(monthly: MonthRow[], year: string, nums?: number[]): number {
  return round2(monthly.filter((r) => r.month.startsWith(year + "-") && (!nums || nums.includes(Number(r.month.slice(5)))))
    .reduce((a, r) => a + r.netWages + r.k401, 0));
}

// ---- Balance sheet (publish.bs_grid) -----------------------------------------------------------
// Header: Code, Account, <month-end dates...>. Sections Assets/Liabilities/Equity; equity ends
// with "Net income, current year"; "Total <type>" rows have an empty code.

export interface BsRow { code: string; name: string; values: number[] }
export interface BsSection { title: string; rows: BsRow[]; total: number[] }
export interface BalanceSheet { title: string; ends: string[]; sections: BsSection[] }
export const EMPTY_BS: BalanceSheet = { title: "", ends: [], sections: [] };

export function parseBalanceSheet(grid: Grid): BalanceSheet {
  const h = grid.findIndex((r) => text(r?.[0]) === "Code" && text(r?.[1]) === "Account");
  if (h < 0) return EMPTY_BS;
  const ends = grid[h].slice(2).map(toIsoDate);
  const vals = (r: unknown[]) => ends.map((_, i) => toNumber(r[2 + i]) ?? 0);
  const sections: BsSection[] = [];
  let cur: BsSection | null = null;
  for (const r of grid.slice(h + 1)) {
    if (!Array.isArray(r) || r.every((c) => text(c) === "")) continue;
    const code = text(r[0]), name = text(r[1]);
    if (code && !name) { cur = { title: code, rows: [], total: [] }; sections.push(cur); continue; }
    if (!cur) continue;
    if (!code && name.startsWith("Total")) cur.total = vals(r);
    else cur.rows.push({ code, name, values: vals(r) });
  }
  return { title: text(grid[0]?.[0]), ends, sections };
}
