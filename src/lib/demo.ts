// Dev-server only (`npm run dev`, ?demo=1): renders the app from the made-up fixtures with no sign-in,
// for visual checks. import.meta.env.DEV is false in the production build, so this never ships active.
import {
  accountsFixture, bsFixture, clientsFixture, deadlinesFixture, decisionsFixture, invoicesFixture, monthlyFixture, outboxFixture, pnlFixture, summaryFixture, txFixture,
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
  "App Deadlines": deadlinesFixture,
  "P&L 2025": pnlFixture, "P&L 2024": [], "Balance Sheet 2025": bsFixture, "Balance Sheet 2024": [], // fixtures stand in for a past year
};
