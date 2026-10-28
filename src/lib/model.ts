import { parseClients, type ClientRow } from "./clients.ts";
import {
  latestDecisions, parseAccounts, parseAppInvoices, parseBalanceSheet, parseDecisions, parseMonthly, parsePnl,
  parseSummary, parseTransactions, type Account, type ArItem, type BalanceSheet, type Decision, type MonthRow, type Pnl,
  type Summary, type Tx,
} from "./parse.ts";
import type { Tabs } from "./sheets.ts";

export interface Model {
  today: string;
  summary: Summary;
  txs: Tx[];
  monthly: MonthRow[];
  invoices: ArItem[];
  latest: Map<string, Decision>;
  accounts: Account[];
  accountNames: Map<string, string>; // code -> name, so screens show names only
  clients: ClientRow[];
  pnl: Pnl;
  bs: BalanceSheet;
  // Past years keyed by year (2025, 2024 from Wave's books); a year with nothing published is left out.
  pnlHistory: Record<string, Pnl>;
  bsHistory: Record<string, BalanceSheet>;
}

export const HISTORY_YEARS = ["2025", "2024"] as const;

// `sent` are decisions saved this session (memory only) so rows show "pending" before a refresh.
export function buildModel(tabs: Tabs, today: string, sent: Decision[] = []): Model {
  const accounts = parseAccounts(tabs["Accounts"]);
  return {
    accountNames: new Map(accounts.map((a) => [a.code, a.name])),
    today,
    summary: parseSummary(tabs["App Summary"]),
    txs: parseTransactions(tabs["App Transactions"]),
    monthly: parseMonthly(tabs["App Monthly"]),
    invoices: parseAppInvoices(tabs["App Invoices"], today),
    latest: latestDecisions([...parseDecisions(tabs["App Decisions"]), ...sent]),
    accounts,
    pnl: parsePnl(tabs["P&L"]),
    clients: parseClients(tabs["App Clients"]),
    bs: parseBalanceSheet(tabs["Balance Sheet"]),
    pnlHistory: Object.fromEntries(HISTORY_YEARS.map((y) => [y, parsePnl(tabs[`P&L ${y}`])]).filter(([, p]) => (p as Pnl).sections.length > 0)),
    bsHistory: Object.fromEntries(HISTORY_YEARS.map((y) => [y, parseBalanceSheet(tabs[`Balance Sheet ${y}`])]).filter(([, b]) => (b as BalanceSheet).sections.length > 0)),
  };
}
