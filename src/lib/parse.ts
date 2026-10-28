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

// Accepts ISO strings, ISO datetimes, or a Sheets serial day number.
export function toIsoDate(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) {
    return new Date(Math.round((v - 25569) * 86_400_000)).toISOString().slice(0, 10);
  }
  const s = text(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
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
  code: string;
  category: string;
  status: string; // booked | review
  source: string;
  locked: boolean; // entry sits in a closed month: no re-booking
}

export function parseTransactions(grid: Grid): Tx[] {
  const out: Tx[] = [];
  for (const r of dataRows(grid)) {
    const entry = text(r[0]);
    const amount = toNumber(r[3]);
    if (!entry || amount === null) continue;
    out.push({
      entry, date: toIsoDate(r[1]), account: text(r[2]), amount, description: text(r[4]),
      code: text(r[5]), category: text(r[6]), status: text(r[7]).toLowerCase(), source: text(r[8]),
      locked: text(r[9]).toLowerCase() === "yes",
    });
  }
  return out;
}

export interface Decision { entry: string; account: string; note: string; who: string; when: string }

export function parseDecisions(grid: Grid): Decision[] {
  return dataRows(grid)
    .map((r) => ({ entry: text(r[0]), account: text(r[1]), note: text(r[2]), who: text(r[3]), when: text(r[4]) }))
    .filter((d) => d.entry && d.account);
}

// Latest row per entry wins (the tab is append-only, so later rows are newer).
export function latestDecisions(ds: Decision[]): Map<string, Decision> {
  const m = new Map<string, Decision>();
  for (const d of ds) m.set(d.entry, d);
  return m;
}

export function isPending(tx: Tx, latest: Map<string, Decision>): boolean {
  const d = latest.get(tx.entry);
  return !!d && d.account !== tx.code;
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

export function txMonths(txs: Tx[]): string[] {
  return [...new Set(txs.map((t) => t.date.slice(0, 7)).filter((m) => /^\d{4}-\d{2}$/.test(m)))].sort().reverse();
}

export function txCategories(txs: Tx[]): { code: string; name: string }[] {
  const m = new Map<string, string>();
  for (const t of txs) if (t.code && !m.has(t.code)) m.set(t.code, t.category);
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

export interface ArItem {
  number: string;
  code: string;
  invoiceDate: string;
  due: string;
  amount: number;
  status: "DRAFT" | "SENT" | "PAID" | string;
  source: string;
  ageDays: number | null;
}

export function parseAppInvoices(grid: Grid, today: string): ArItem[] {
  const out: ArItem[] = [];
  for (const r of dataRows(grid)) {
    const number = text(r[0]);
    const amount = toNumber(r[4]);
    if (!number || amount === null) continue;
    const invoiceDate = toIsoDate(r[2]);
    out.push({
      number, code: customerCode(r[1]), invoiceDate, due: toIsoDate(r[3]), amount,
      status: text(r[5]).toUpperCase(), source: text(r[6]), ageDays: daysBetween(invoiceDate, today),
    });
  }
  return out;
}

export interface InvoiceStats {
  outstanding: ArItem[]; // SENT, oldest first
  outstandingTotal: number;
  overdue: ArItem[];
  oldestAgeDays: number | null;
  drafts: ArItem[];
  draftsTotal: number;
  paid30: ArItem[]; // PAID, invoice dated in the last 30 days (the tab has no paid date)
  paid30Total: number;
}

export function invoiceStats(items: ArItem[], today: string): InvoiceStats {
  const sum = (xs: ArItem[]) => round2(xs.reduce((s, i) => s + i.amount, 0));
  const outstanding = items.filter((i) => i.status === "SENT").sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1));
  const overdue = outstanding.filter((i) => i.due && i.due < today);
  const drafts = items.filter((i) => i.status === "DRAFT");
  const paid30 = items.filter((i) => i.status === "PAID" && i.ageDays !== null && i.ageDays >= 0 && i.ageDays <= 30);
  return {
    outstanding, outstandingTotal: sum(outstanding), overdue,
    oldestAgeDays: outstanding.length ? outstanding[0].ageDays : null,
    drafts, draftsTotal: sum(drafts), paid30, paid30Total: sum(paid30),
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

export type Period = "1M" | "3M" | "6M" | "YTD";
export const PERIODS: Period[] = ["1M", "3M", "6M", "YTD"];
export const PERIOD_LABEL: Record<Period, string> = { "1M": "This month", "3M": "Last 3 months", "6M": "Last 6 months", YTD: "Year to date" };

// Months in the period ending at the as-of month (the open month counts, to date). Rows sorted ascending.
export function periodMonths(monthly: MonthRow[], asOf: string, p: Period): MonthRow[] {
  const upto = (asOf.slice(0, 7) || monthly[monthly.length - 1]?.month || "");
  const rows = monthly.filter((r) => r.month <= upto);
  if (p === "YTD") return rows.filter((r) => r.month.startsWith(upto.slice(0, 4) + "-"));
  return rows.slice(-Number(p[0]));
}

// Trends can also look further back: the last 12 months, or every month published.
export type TrendRange = Period | "12M" | "ALL";
export const TREND_RANGES: TrendRange[] = ["3M", "6M", "YTD", "12M", "ALL"];
export function trendMonths(monthly: MonthRow[], asOf: string, r: TrendRange): MonthRow[] {
  if (r !== "12M" && r !== "ALL") return periodMonths(monthly, asOf, r);
  const upto = asOf.slice(0, 7) || monthly[monthly.length - 1]?.month || "";
  const rows = monthly.filter((x) => x.month <= upto);
  return r === "ALL" ? rows : rows.slice(-12);
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
export function compareYears(monthly: MonthRow[], asOf: string, p: Period): YearCompare {
  const cur = periodMonths(monthly, asOf, p);
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
