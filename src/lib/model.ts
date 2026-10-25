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
  pnl: Pnl;
  bs: BalanceSheet;
}

// `sent` are decisions saved this session (memory only) so rows show "pending" before a refresh.
export function buildModel(tabs: Tabs, today: string, sent: Decision[] = []): Model {
  return {
    today,
    summary: parseSummary(tabs["App Summary"]),
    txs: parseTransactions(tabs["App Transactions"]),
    monthly: parseMonthly(tabs["App Monthly"]),
    invoices: parseAppInvoices(tabs["App Invoices"], today),
    latest: latestDecisions([...parseDecisions(tabs["App Decisions"]), ...sent]),
    accounts: parseAccounts(tabs["Accounts"]),
    pnl: parsePnl(tabs["P&L"]),
    bs: parseBalanceSheet(tabs["Balance Sheet"]),
  };
}
