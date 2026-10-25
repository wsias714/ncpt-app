// Pure parsers for the NCPT Books Sheet tabs (layouts: CFO/ncpt_books/publish.py and close.py).
// Input is the raw `values` grid from the Sheets API. Customer names are never read: only a
// short code like "Customer V" is passed through, anything else collapses to UNLABELED.

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

const text = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

export function customerCode(v: unknown): string {
  const s = text(v);
  return CODE_RE.test(s) ? s : UNLABELED;
}

export interface Dashboard {
  asOf: string;
  cash: number | null;
  card: number | null; // positive = owed on the card
  ar: number | null;
  ytdNetCash: number | null;
  ytdNetAccrual: number | null;
  lastClosedMonth: string;
  monthsReadyToLock: string;
  bankRecThrough: string;
  entriesToReview: number | null;
  closeBlockers: string[]; // empty when "none"
}

function byLabel(grid: Grid): Map<string, unknown[]> {
  const m = new Map<string, unknown[]>();
  for (const row of grid) {
    const label = text(row[0]);
    if (label && !m.has(label)) m.set(label, row);
  }
  return m;
}

export function parseDashboard(grid: Grid): Dashboard {
  const rows = byLabel(grid);
  const find = (pred: (l: string) => boolean): unknown[] | undefined => {
    for (const [l, r] of rows) if (pred(l)) return r;
    return undefined;
  };
  const num = (pred: (l: string) => boolean) => toNumber(find(pred)?.[1]);
  const str = (pred: (l: string) => boolean) => text(find(pred)?.[1]);
  const title = grid[0] ?? [];
  const blockersRaw = str((l) => l === "Close blockers");
  return {
    asOf: text(title[1]).replace(/^as of\s*/i, ""),
    cash: num((l) => l.startsWith("Cash")),
    card: num((l) => l.startsWith("Credit card")),
    ar: num((l) => l === "Accounts receivable"),
    ytdNetCash: num((l) => /YTD net income, cash/.test(l)),
    ytdNetAccrual: num((l) => /YTD net income, accrual/.test(l)),
    lastClosedMonth: str((l) => l === "Last closed month"),
    monthsReadyToLock: str((l) => l === "Months ready to lock"),
    bankRecThrough: str((l) => l === "Bank rec through"),
    entriesToReview: num((l) => l === "Entries to review"),
    closeBlockers: !blockersRaw || blockersRaw === "none" ? [] : blockersRaw.split(";").map((s) => s.trim()).filter(Boolean),
  };
}

export interface CloseMonth {
  month: string;
  status: string; // LOCKED | READY TO LOCK | BLOCKED
  blockers: string[];
  locked: boolean;
}

export interface Close {
  months: CloseMonth[];
  arDifference: number | null;
}

export function parseClose(grid: Grid): Close {
  const months: CloseMonth[] = [];
  let arDifference: number | null = null;
  let section: "months" | "other" = "months";
  for (let i = 1; i < grid.length; i++) {
    const row = grid[i] ?? [];
    const first = text(row[0]);
    if (!first) { section = "other"; continue; }
    if (section === "months" && /^\d{4}-\d{2}$/.test(first)) {
      months.push({
        month: first,
        status: text(row[5]),
        blockers: text(row[3]).split(";").map((s) => s.trim()).filter(Boolean),
        locked: text(row[6]).toLowerCase() === "yes",
      });
    } else if (first === "AR") {
      const data = grid[i + 1] ?? [];
      arDifference = toNumber(data[5]);
    }
  }
  return { months, arDifference };
}

export interface ArItem {
  number: string;
  code: string;
  invoiceDate: string;
  due: string;
  amount: number;
  status: string;
  ageDays: number | null;
}

const CLOSED_STATUS = /^(paid|void|voided|draft|cancelled|canceled)$/i;

export function daysBetween(fromIso: string, today: string): number | null {
  const a = Date.parse(fromIso + "T00:00:00Z");
  const b = Date.parse(today + "T00:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

// Reads the Invoices tab by header name; the "Customer" column is reduced to a code.
export function parseInvoices(grid: Grid, today: string): ArItem[] {
  const head = (grid[0] ?? []).map(text);
  const col = (name: string) => head.indexOf(name);
  const iNum = col("Number"), iCust = col("Customer"), iDate = col("Invoice date");
  const iDue = col("Due"), iTotal = col("Total"), iStatus = col("Status");
  if ([iNum, iCust, iDate, iTotal, iStatus].some((i) => i < 0)) return [];
  const out: ArItem[] = [];
  for (const row of grid.slice(1)) {
    const number = text(row[iNum]);
    const amount = toNumber(row[iTotal]);
    const status = text(row[iStatus]);
    if (!number || amount === null || CLOSED_STATUS.test(status)) continue;
    const invoiceDate = text(row[iDate]);
    out.push({
      number,
      code: customerCode(row[iCust]),
      invoiceDate,
      due: iDue >= 0 ? text(row[iDue]) : "",
      amount,
      status,
      ageDays: daysBetween(invoiceDate, today),
    });
  }
  return out.sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1));
}

export function totalOpen(items: ArItem[]): number {
  return Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100;
}

export function money(n: number | null): string {
  if (n === null) return "n/a";
  const s = Math.abs(n).toLocaleString("en-US", { style: "currency", currency: "USD" });
  return n < 0 ? `-${s}` : s;
}
