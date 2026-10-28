// Client revenue and visits over time (App Clients tab: one row per month and client code).
// Codes only: names are swapped in at display time, and only when names are on.
import { text, toNumber, type Grid } from "./parse.ts";

export interface ClientRow { month: string; code: string; invoiced: number; collected: number; visits: number; invoices: number }

export function parseClients(grid: Grid): ClientRow[] {
  const h = grid.findIndex((r) => text(r?.[0]) === "Month" && text(r?.[1]) === "Code");
  if (h < 0) return [];
  return grid.slice(h + 1).filter((r) => Array.isArray(r) && /^\d{4}-\d{2}$/.test(text(r[0]))).map((r) => ({
    month: text(r[0]), code: text(r[1]), invoiced: toNumber(r[2]) ?? 0, collected: toNumber(r[3]) ?? 0,
    visits: toNumber(r[4]) ?? 0, invoices: toNumber(r[5]) ?? 0,
  }));
}

const round2 = (n: number) => Math.round(n * 100) / 100;
export const clientYears = (rows: ClientRow[]): string[] => [...new Set(rows.map((r) => r.month.slice(0, 4)))].sort().reverse();

// "ALL", "12M" (the twelve months ending at the as-of month) or a calendar year.
export type ClientRange = string;
export function inRange(rows: ClientRow[], range: ClientRange, asOf: string): ClientRow[] {
  const upto = asOf.slice(0, 7);
  if (range === "ALL") return rows.filter((r) => r.month <= upto);
  if (range === "12M") {
    const [y, m] = upto.split("-").map(Number);
    const from = `${m === 12 ? y : y - 1}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`;
    return rows.filter((r) => r.month >= from && r.month <= upto);
  }
  return rows.filter((r) => r.month.startsWith(range + "-") && r.month <= upto);
}

export interface ClientTotals { revenue: number; collected: number; visits: number; invoices: number; clients: number; perVisit: number | null }
export function summarize(rows: ClientRow[]): ClientTotals {
  const revenue = round2(rows.reduce((a, r) => a + r.invoiced, 0)), visits = round2(rows.reduce((a, r) => a + r.visits, 0));
  return {
    revenue, visits, collected: round2(rows.reduce((a, r) => a + r.collected, 0)), invoices: rows.reduce((a, r) => a + r.invoices, 0),
    clients: new Set(rows.filter((r) => r.invoiced !== 0 || r.visits !== 0).map((r) => r.code)).size,
    perVisit: visits > 0 ? round2(revenue / visits) : null,
  };
}

export interface YearRow extends ClientTotals { year: string; newClients: number }
// Newest year first. "New" means the client's first invoice (in any year published) fell in that year.
export function byYear(all: ClientRow[]): YearRow[] {
  const first = new Map<string, string>();
  for (const r of all) if (r.invoiced !== 0 || r.visits !== 0) { const f = first.get(r.code); if (!f || r.month < f) first.set(r.code, r.month); }
  return clientYears(all).map((year) => ({
    year, ...summarize(all.filter((r) => r.month.startsWith(year + "-"))),
    newClients: [...first.values()].filter((m) => m.startsWith(year + "-")).length,
  }));
}

export interface MonthPoint { month: string; revenue: number; visits: number; clients: number }
export function byMonth(rows: ClientRow[]): MonthPoint[] {
  const months = [...new Set(rows.map((r) => r.month))].sort();
  return months.map((month) => {
    const mine = rows.filter((r) => r.month === month);
    const t = summarize(mine);
    return { month, revenue: t.revenue, visits: t.visits, clients: t.clients };
  });
}

export interface ClientLine { code: string; revenue: number; visits: number; share: number; first: string; last: string }
// Clients in the range by revenue, with first and last month taken over every published month.
export function byClient(rows: ClientRow[], all: ClientRow[]): ClientLine[] {
  const total = rows.reduce((a, r) => a + r.invoiced, 0);
  const span = new Map<string, [string, string]>();
  for (const r of all) if (r.invoiced !== 0 || r.visits !== 0) {
    const s = span.get(r.code);
    span.set(r.code, s ? [r.month < s[0] ? r.month : s[0], r.month > s[1] ? r.month : s[1]] : [r.month, r.month]);
  }
  const by = new Map<string, { revenue: number; visits: number }>();
  for (const r of rows) { const b = by.get(r.code) ?? { revenue: 0, visits: 0 }; b.revenue += r.invoiced; b.visits += r.visits; by.set(r.code, b); }
  return [...by.entries()].filter(([, b]) => b.revenue !== 0 || b.visits !== 0).map(([code, b]) => ({
    code, revenue: round2(b.revenue), visits: round2(b.visits), share: total > 0 ? b.revenue / total : 0,
    first: span.get(code)?.[0] ?? "", last: span.get(code)?.[1] ?? "",
  })).sort((a, b) => b.revenue - a.revenue);
}

export const visitsText = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));
