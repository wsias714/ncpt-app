// Dev-server only (`npm run dev`, ?demo=1): renders the app from the made-up fixtures with no sign-in,
// for visual checks. import.meta.env.DEV is false in the production build, so this never ships active.
// Demo mode never writes anywhere: every append is skipped and only remembered for the session.
// Extra switches for checking states: &payroll=block (a check blocks Approve), &payroll=none and &kits=none (tab not published),
// &upcoming=none (App Upcoming not published yet), &outbox=on (show the made-up email previews even with names off;
// by default demo mirrors the real app, where previews need Names on).
import {
  accountsFixture, bsFixture, clientsFixture, deadlinesFixture, decisionsFixture, decisionsWithStatusFixture, invoicesFixture, kitDeadlinesFixture,
  kitsFixture, monthlyFixture, outboxFixture, payrollBlockedFixture, payrollFixture, pnlFixture, summaryFixture, txFixture, txIgnoredRows,
} from "./fixtures.ts";
import type { Grid } from "./parse.ts";
import type { Tabs } from "./sheets.ts";
import { addDays, md, UPCOMING_HEAD } from "./upcoming.ts";

export const demoOutbox = outboxFixture;

export const demoActive = (search: string): boolean => import.meta.env.DEV && new URLSearchParams(search).has("demo");

export const demoTabs: Tabs = {
  "App Summary": summaryFixture,
  "App Transactions": [...txFixture, ...txIgnoredRows],
  "App Monthly": monthlyFixture,
  "App Invoices": invoicesFixture,
  "App Decisions": [...decisionsFixture, ...decisionsWithStatusFixture.slice(1, 3)],
  "P&L": pnlFixture,
  "Balance Sheet": bsFixture,
  "Accounts": accountsFixture,
  "App Clients": clientsFixture,
  "App Deadlines": [...deadlinesFixture, ...kitDeadlinesFixture.slice(1)],
  "App Payroll": payrollFixture,
  "App Kits": kitsFixture,
  "P&L 2025": pnlFixture, "P&L 2024": [], "Balance Sheet 2025": bsFixture, "Balance Sheet 2024": [], // fixtures stand in for a past year
};

/** Made-up App Invoices (10 columns) dated around `today`, so every Invoices section has something in it. */
export function demoInvoices(today: string): Grid {
  const d = (n: number) => addDays(today, n);
  return [
    ["Number", "Code", "Invoice date", "Due", "Total", "Status", "Source", "Paid on", "Deposit", "Email draft"],
    ["9101", "Customer A", d(-1), d(-1), 200, "DRAFT", "ncpt-books", "", "", "Y"],
    ["9102", "Customer B", d(-2), d(-2), 450, "DRAFT", "ncpt-books", "", "", "Y"],
    ["9103", "Customer F", d(-1), d(-1), 200, "DRAFT", "ncpt-books", "", "", "N"],
    ["9104", "Customer C", d(-31), d(0), 1350, "SENT", "ncpt-books", "", "", "N"],
    ["9105", "Customer D", d(-9), d(-9), 200, "ISSUED", "ncpt-books", "", "", "N"],
    ["9106", "Customer E", d(-50), d(-20), 600, "SENT", "wave", "", "", "N"],
    ["9107", "Customer A", d(-20), d(-20), 900, "PAID", "wave", d(-12), `${md(d(-12))} $899.50 + ${md(d(-12))} $0.50`, "N"],
    ["9108", "Customer B", d(-30), d(-30), 400, "PAID", "wave", d(-4), "cash", "N"],
    ["9109", "Customer C", d(-3), d(-3), 200, "VOID", "ncpt-books", "", "", "N"],
  ];
}

/** Made-up App Upcoming rows in every State, Pacific times, around `today`. */
export function demoUpcoming(today: string): Grid {
  const d = (n: number) => addDays(today, n);
  const t = (n: number, hm: string) => `${d(n)}T${hm}-08:00`;
  const pub = new Date().toISOString();
  const month = today.slice(0, 7);
  const monthEnd = addDays(addDays(month + "-01", 32).slice(0, 7) + "-01", -1);
  const row = (key: string, code: string, billing: string, s: string, e: string, hours: string, visits: string, amount: string,
    state: string, number = "", note = "", fp = "fp-" + key) =>
    [key, code, billing, s, e, hours, visits, amount, s.slice(0, 10), e, state, number, note, fp, pub];
  return [
    [...UPCOMING_HEAD],
    row("V-demo-1", "Customer A", "per_visit", t(-1, "09:00"), t(-1, "10:30"), "1.5", "1", "300.00", "READY", "", "No visit note yet"),
    row("V-demo-2", "Customer F", "per_visit", t(-1, "15:00"), t(-1, "16:00"), "1", "1", "200.00", "DRAFTED", "9103"),
    row("V-demo-3", "Customer C", "at_visit", t(0, "08:00"), t(0, "09:00"), "1", "1", "200.00", "READY", "", "Hand it over at the visit, then Mark issued"),
    row("V-demo-4", "Customer D", "per_visit", t(0, "18:00"), t(0, "19:00"), "1", "1", "200.00", "UPCOMING"),
    row("V-demo-5", "Customer E", "per_visit", t(1, "11:30"), t(1, "13:00"), "1.5", "1", "300.00", "UPCOMING", "", "Customer inactive: turn it on in Customers before billing"),
    row("V-demo-6", "Customer G", "per_visit", t(2, "10:00"), t(2, "11:00"), "1", "1", "200.00", "WAVE", "", "Before the start date: bill in Wave"),
    row("V-demo-7", "Customer A", "per_visit", t(3, "09:00"), t(3, "10:00"), "1", "1", "200.00", "SENT", "9110"),
    row("V-demo-8", "Customer D", "at_visit", t(4, "14:00"), t(4, "15:00"), "1", "1", "200.00", "ISSUED", "9111"),
    row("V-demo-9", "Customer H", "per_visit", t(5, "16:00"), t(5, "17:00"), "1", "1", "200.00", "PAID", "9112"),
    row("V-demo-10", "Customer A", "per_visit", t(9, "09:00"), t(9, "10:00"), "1", "1", "200.00", "UPCOMING"),
    [`M-${month}-CustomerB`, "Customer B", "monthly", `${month}-02T09:00-08:00`, `${monthEnd}T10:30-08:00`, "4.5", "3", "1012.50", `${month}-01`,
      `${monthEnd}T10:30-08:00`, "UPCOMING", "", `3 of 5 visits, 4.5 h, $1,012.50 so far, ready ${Number(monthEnd.slice(5, 7))}/${Number(monthEnd.slice(8))}; 2 without a visit note yet`,
      "fp-monthly-b", pub],
    ["UNLINKED", "", "", "", "", "", "2", "", "", "", "UNLINKED", "", "2 calendar event(s) in the window matched no customer", "", pub],
  ];
}

export function demoTabsFor(search: string, today: string): Tabs {
  const q = new URLSearchParams(search);
  return {
    ...demoTabs,
    "App Invoices": demoInvoices(today),
    "App Payroll": q.get("payroll") === "block" ? payrollBlockedFixture : q.get("payroll") === "none" ? [] : payrollFixture,
    "App Kits": q.get("kits") === "none" ? [] : kitsFixture,
  };
}

export const demoUpcomingFor = (search: string, today: string): Grid =>
  new URLSearchParams(search).get("upcoming") === "none" ? [] : demoUpcoming(today);

export const demoOutboxOn = (search: string, namesOn: boolean): boolean => namesOn || new URLSearchParams(search).get("outbox") === "on";
