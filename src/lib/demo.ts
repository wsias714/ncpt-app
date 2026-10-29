// Dev-server only (`npm run dev`, ?demo=1): renders the app from the made-up fixtures with no sign-in,
// for visual checks. import.meta.env.DEV is false in the production build, so this never ships active.
// Extra switches for checking states: &payroll=block (a check blocks Approve), &payroll=none and &kits=none (tab not published).
import {
  accountsFixture, bsFixture, clientsFixture, deadlinesFixture, decisionsFixture, invoicesFixture, kitDeadlinesFixture, kitsFixture, monthlyFixture,
  outboxFixture, payrollBlockedFixture, payrollFixture, pnlFixture, summaryFixture, txFixture,
} from "./fixtures.ts";
import type { Tabs } from "./sheets.ts";

export const demoOutbox = outboxFixture;

export const demoActive = (search: string): boolean => import.meta.env.DEV && new URLSearchParams(search).has("demo");

export const demoTabs: Tabs = {
  "App Summary": summaryFixture,
  "App Transactions": txFixture,
  "App Monthly": monthlyFixture,
  "App Invoices": invoicesFixture,
  "App Decisions": decisionsFixture,
  "P&L": pnlFixture,
  "Balance Sheet": bsFixture,
  "Accounts": accountsFixture,
  "App Clients": clientsFixture,
  "App Deadlines": [...deadlinesFixture, ...kitDeadlinesFixture.slice(1)],
  "App Payroll": payrollFixture,
  "App Kits": kitsFixture,
  "P&L 2025": pnlFixture, "P&L 2024": [], "Balance Sheet 2025": bsFixture, "Balance Sheet 2024": [], // fixtures stand in for a past year
};

export function demoTabsFor(search: string): Tabs {
  const q = new URLSearchParams(search);
  return {
    ...demoTabs,
    "App Payroll": q.get("payroll") === "block" ? payrollBlockedFixture : q.get("payroll") === "none" ? [] : payrollFixture,
    "App Kits": q.get("kits") === "none" ? [] : kitsFixture,
  };
}
