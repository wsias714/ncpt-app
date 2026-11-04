import { describe, expect, it } from "vitest";
import {
  beforeOwnerPay, compareYears, monthlyYears, ownerPayInMonths, periodMonths, totals, trendMonths, NO_FILTER, UNLABELED, accountPickerOrder, customerCode, daysBetween, filterTransactions, invoiceStats, isPending,
  hasTransactionsForCode, latestDecisions, money, needsBooking, parseAccounts, parseAppInvoices, parseBalanceSheet, parseDecisions,
  parseMonthly, parsePnl, parseSummary, parseTransactions, recentTransactions, toIsoDate, toNumber, totalOpen,
  txCategories, txMonths, wagesTotal, periodWindow, profitPoints, payrollSwingNote, addMonths, type MonthRow, type Period,
} from "./parse.ts";
import { demoTabs } from "./demo.ts";
import { buildModel } from "./model.ts";
import {
  accountsFixture, bsFixture, decisionsFixture, invoicesFixture, monthlyFixture, pnlFixture, summaryFixture, txFixture,
} from "./fixtures.ts";

describe("toNumber / toIsoDate", () => {
  it("handles numbers, formatted strings and parentheses", () => {
    expect(toNumber(12.5)).toBe(12.5);
    expect(toNumber("$1,234.50")).toBe(1234.5);
    expect(toNumber("(10.00)")).toBe(-10);
    expect(toNumber("-3")).toBe(-3);
    expect(toNumber("")).toBeNull();
    expect(toNumber("n/a")).toBeNull();
    expect(toNumber(undefined)).toBeNull();
  });
  it("normalizes dates", () => {
    expect(toIsoDate("2030-03-15T06:00")).toBe("2030-03-15");
    expect(toIsoDate(25569)).toBe("1970-01-01");
    expect(toIsoDate("soon")).toBe("soon");
  });
});

describe("parseSummary", () => {
  const s = parseSummary(summaryFixture);
  it("reads keys", () => {
    expect(s).toMatchObject({ asOf: "2030-03-15", profitMtd: 1200.5, profitYtd: 9100, cash: 10000.5, cardOwed: 250, ar: 1500, needsBooking: 3, mileageDue: "2030-04-01", lastClosedMonth: "2030-01", present: true });
    expect(s.closeBlockers).toEqual(["2030-02: bank rec off by 12.00", "2030-02: payroll residue"]);
    expect(wagesTotal(s)).toBe(5550);
    expect(s).toMatchObject({ netWagesYtd: 4500, k401Ytd: 150 });
    expect(beforeOwnerPay(s.profitYtd, 4650)).toBe(13750);
    expect(beforeOwnerPay(null, 5)).toBeNull();
  });
  it("sums time periods, owner pay and year over year from the monthly rows", () => {
    const monthly = parseMonthly(monthlyFixture);
    expect(monthly.map((r) => r.month)).toEqual(["2029-02", "2029-03", "2030-01", "2030-02", "2030-03"]);
    expect(monthly.map((r) => r.netWages)).toEqual([1000, 0, 2300, 2200, 0]);
    const months = (p: Period) => periodMonths(monthly, "2030-03-15", p).map((r) => r.month);
    expect(months("1M")).toEqual(["2030-03"]); // the open month to date
    expect(months("3M")).toEqual(["2030-01", "2030-02"]); // the 3 full months are Dec-Feb; Dec 2029 has no row
    expect(months("6M")).toEqual(["2030-01", "2030-02"]);
    expect(months("12M")).toEqual(["2029-03", "2030-01", "2030-02"]); // Apr 2029 to Feb 2030; 2029-02 is 13 months back
    expect(months("YTD")).toEqual(["2030-01", "2030-02", "2030-03"]); // through the as-of date, open month included
    const t = totals(periodMonths(monthly, "2030-03-15", "3M"));
    expect(t).toMatchObject({ months: 2, income: 7500, net: 5400, netWages: 4500, k401: 150, ownerPay: 4650, beforeOwnerPay: 10050 });
    expect(ownerPayInMonths(monthly, "2030", [2])).toBe(2300);
    expect(ownerPayInMonths(monthly, "2030")).toBe(4650);
    expect(ownerPayInMonths(monthly, "2031")).toBe(0);
    const y = compareYears(monthly, "2030-03-15", "3M");
    expect(y.priorMonths).toBe(1); // only 2029-02 exists among 2029-01 and 2029-02
    expect(y.prior.net).toBe(2100);
    expect(y.priorLabel).toBe("2029-01 to 2029-02");
    expect(compareYears(monthly, "2029-03-01", "1M").priorMonths).toBe(0); // no 2028
    // a past year passes asOfComplete: its December-like last month is complete
    expect(periodMonths(monthly, "2029-03-31", "3M", { asOfComplete: true }).map((r) => r.month)).toEqual(["2029-02", "2029-03"]);
  });
  it("trend ranges reach back to every full published month, and years are listed newest first", () => {
    const monthly = parseMonthly(monthlyFixture);
    const t = (r: "3M" | "6M" | "YTD" | "12M" | "ALL") => trendMonths(monthly, "2030-03-15", r).map((x) => x.month);
    expect(t("3M")).toEqual(["2030-01", "2030-02"]);
    expect(t("YTD")).toEqual(["2030-01", "2030-02", "2030-03"]);
    expect(t("12M")).toHaveLength(3);
    expect(t("ALL")).toEqual(["2029-02", "2029-03", "2030-01", "2030-02"]); // the open month is not a full bar
    expect(trendMonths(monthly, "2029-03-01", "ALL").map((x) => x.month)).toEqual(["2029-02"]);
    expect(monthlyYears(monthly)).toEqual(["2030", "2029"]);
    // a past year compares against the year before it
    expect(compareYears(monthly, "2029-12-31", "YTD", { asOfComplete: true }).priorMonths).toBe(0);
  });
  it("builds past-year statements only when the tab has data", () => {
    const tabs = { ...demoTabs, "P&L 2025": pnlFixture, "P&L 2024": [], "Balance Sheet 2025": [], "Balance Sheet 2024": [] };
    const m = buildModel(tabs, "2030-03-15");
    expect(Object.keys(m.pnlHistory)).toEqual(["2025"]);
    expect(m.pnlHistory["2025"].sections.map((s) => s.title)).toEqual(["Income", "Expense"]);
    expect(m.bsHistory).toEqual({});
  });
  it("treats none as clear and survives empty", () => {
    expect(parseSummary([["Key", "Value"], ["close_blockers", "none"]]).closeBlockers).toEqual([]);
    const e = parseSummary([]);
    expect(e.present).toBe(false);
    expect(e.cash).toBeNull();
    expect(wagesTotal(e)).toBeNull();
  });
});

describe("transactions and decisions", () => {
  const txs = parseTransactions(txFixture);
  const latest = latestDecisions(parseDecisions(decisionsFixture));
  it("parses rows and locked flag", () => {
    expect(txs).toHaveLength(6);
    expect(txs[0]).toMatchObject({ entry: "bank:t6", amount: -45.2, status: "review", locked: false });
    expect(txs[4].locked).toBe(true);
    expect(parseTransactions([])).toEqual([]);
  });
  it("latest decision wins; pending only when it differs from the published code", () => {
    expect(latest.get("bank:t5")?.account).toBe("7000");
    expect(isPending(txs[1], latest)).toBe(false); // decision equals published code
    expect(isPending(txs[0], latest)).toBe(true);
    expect(isPending(txs[3], latest)).toBe(false);
  });
  it("needs booking excludes pending lines", () => {
    expect(txs.filter((t) => needsBooking(t, latest)).map((t) => t.entry)).toEqual(["bank:t3"]);
  });
  it("filters by query, account, month, review and category", () => {
    const f = (p: Partial<typeof NO_FILTER>) => filterTransactions(txs, { ...NO_FILTER, ...p }, latest).map((t) => t.entry);
    expect(f({ query: "office" })).toEqual(["bank:t6", "bank:t1"]);
    expect(f({ query: "600" })).toEqual(["bank:t4"]);
    expect(f({ account: "Card" })).toEqual(["bank:t5", "bank:t1"]);
    expect(f({ month: "2030-02" })).toEqual(["bank:t2"]);
    expect(f({ reviewOnly: true })).toEqual(["bank:t3"]);
    expect(f({ code: "4000" })).toEqual(["bank:t4"]);
  });
  it("only offers transaction filtering for account codes present in App Transactions", () => {
    expect(hasTransactionsForCode(txs, "4000")).toBe(true);
    // Accrual revenue can exist in the statement without a corresponding bank/card line.
    expect(hasTransactionsForCode(txs, "4300")).toBe(false);
    expect(hasTransactionsForCode(txs, "")).toBe(false);
    expect(filterTransactions(txs, { ...NO_FILTER, code: "4300" }, latest)).toEqual([]);
  });
  it("lists months, categories and the last 7 days", () => {
    expect(txMonths(txs)).toEqual(["2030-03", "2030-02", "2030-01"]);
    expect(txCategories(txs).map((c) => c.code)).toEqual(["4000", "6100", "6200", "7000"]);
    expect(recentTransactions(txs, "2030-03-15").map((t) => t.entry)).toEqual(["bank:t6", "bank:t5", "bank:t4"]);
  });
});

describe("parseMonthly", () => {
  it("sorts oldest first", () => {
    const m = parseMonthly(monthlyFixture);
    expect(m.map((r) => r.month)).toEqual(["2029-02", "2029-03", "2030-01", "2030-02", "2030-03"]);
    expect(m[4]).toMatchObject({ income: 2000, netCash: 1200, cashEnd: 10000.5, arEnd: 1500, cardEnd: 250 });
    expect(parseMonthly([])).toEqual([]);
  });
});

describe("invoices", () => {
  const items = parseAppInvoices(invoicesFixture, "2030-03-15");
  const st = invoiceStats(items, "2030-03-15");
  it("computes outstanding, overdue, drafts and recent paid", () => {
    expect(st.outstanding.map((i) => i.number)).toEqual(["9001", "9003"]);
    expect(st.outstandingTotal).toBe(1500);
    expect(st.overdue.map((i) => i.number)).toEqual(["9001"]);
    expect(st.oldestAgeDays).toBe(73);
    expect(st.drafts.map((i) => i.number)).toEqual(["9004"]);
    expect(st.draftsTotal).toBe(100);
    expect(st.paid30.map((i) => i.number)).toEqual(["9002"]);
    expect(totalOpen(items)).toBe(1950);
  });
  it("never passes through a non-code label", () => {
    expect(items[2].code).toBe(UNLABELED);
    expect(JSON.stringify(items)).not.toContain("Not A Code");
  });
  it("tolerates an empty tab", () => {
    expect(invoiceStats(parseAppInvoices([], "2030-03-15"), "2030-03-15").oldestAgeDays).toBeNull();
  });
});

describe("accounts", () => {
  it("puts income and expense first", () => {
    const a = accountPickerOrder(parseAccounts(accountsFixture));
    expect(a.map((x) => x.code)).toEqual(["4000", "6200", "7000", "1000", "2000"]);
  });
});

describe("statements", () => {
  it("parses the P&L layout", () => {
    const p = parsePnl(pnlFixture);
    expect(p.months).toEqual(["Jan", "Feb", "Mar"]);
    expect(p.sections.map((s) => s.title)).toEqual(["Income", "Expense"]);
    expect(p.sections[1].rows[1]).toMatchObject({ code: "7000", line: "19", values: [1000, 800, 500, 2300, 2300] });
    expect(p.sections[1].total).toEqual([1100, 1000, 800, 2900, 2900]);
    expect(p.net).toEqual([2400, 3000, 1200, 6600, 6900]);
    expect(parsePnl([]).sections).toEqual([]);
  });
  it("parses the balance sheet layout", () => {
    const b = parseBalanceSheet(bsFixture);
    expect(b.ends).toEqual(["2030-01-31", "2030-02-28", "2030-03-15"]);
    expect(b.sections.map((s) => s.title)).toEqual(["Assets", "Liabilities", "Equity"]);
    expect(b.sections[0].total).toEqual([7900, 10200, 11500.5]);
    expect(b.sections[2].rows.map((r) => r.name)).toEqual(["Owner equity", "Net income, current year"]);
    expect(parseBalanceSheet([]).ends).toEqual([]);
  });
  it("keeps the shareholder basis block as a section without a total", () => {
    const grid = [
      ["Balance sheet 2030 (accrual), month ends through 2030-02-28"], [], ["Code", "Account", "2030-01-31", "2030-02-28"],
      ["Assets"], ["1000", "Checking", 100, 200], ["", "Total asset", 100, 200], [],
      ["Shareholder basis (tax, cash; an estimate, see the basis trace)"],
      ["", "Stock basis, beginning of year", 1000, 1000], ["", "Stock basis, period end", 1050, 1075.5],
    ];
    const b = parseBalanceSheet(grid);
    expect(b.sections.map((s) => s.title)).toEqual(["Assets", "Shareholder basis (tax, cash; an estimate, see the basis trace)"]);
    expect(b.sections[1].total).toEqual([]);
    expect(b.sections[1].rows[1]).toMatchObject({ name: "Stock basis, period end", values: [1050, 1075.5] });
  });
});

describe("helpers", () => {
  it("customerCode accepts short codes only", () => {
    expect(customerCode("Customer V")).toBe("Customer V");
    expect(customerCode("Customer " + "Zed")).toBe(UNLABELED);
    expect(customerCode("")).toBe(UNLABELED);
  });
  it("daysBetween and money", () => {
    expect(daysBetween("2030-03-01", "2030-03-15")).toBe(14);
    expect(daysBetween("garbage", "2030-03-15")).toBeNull();
    expect(money(-5)).toBe("-$5.00");
    expect(money(null)).toBe("n/a");
  });
});


// Made-up months shaped like the real figures: a quarterly payroll in Sep, a young ledger starting in January.
describe("profit windows (3M, 6M, 12M are full months; 1M is the open month)", () => {
  const row = (month: string, netCash: number, netWages = 0, k401 = 0): MonthRow => ({
    month, income: netCash === 0 ? 0 : Math.max(0, netCash) + 1000, expense: netCash === 0 ? 0 : 1000, netCash, netAccrual: netCash, cashEnd: 0, arEnd: 0, cardEnd: 0, netWages, k401,
  });
  const base = [
    row("2026-01", 2000), row("2026-02", 1500), row("2026-03", 900), row("2026-04", 1200), row("2026-05", 800), row("2026-06", 700),
    row("2026-07", 400),
    row("2026-08", 11159.12), row("2026-09", -17140.04, 11381.25, 3125), row("2026-10", 6364.65),
  ];

  it("on Nov 1 the 3M window is Aug to Oct with the payroll quarter in it", () => {
    const monthly = [...base, row("2026-11", 0)];
    const w = periodWindow(monthly, "2026-11-01", "3M");
    expect(w.rows.map((r) => r.month)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(w.label).toBe("Aug to Oct 2026 (3 full months)");
    const t = totals(w.rows);
    expect(t.net).toBe(383.73);
    expect(t.beforeOwnerPay).toBe(14889.98);
    expect(payrollSwingNote(w.rows, "3M")).toBe("");
  });

  it("the 6M and 12M windows end the month before as-of and say when history is shorter", () => {
    const monthly = [...base, row("2026-11", 0)];
    expect(periodWindow(monthly, "2026-11-01", "6M").rows.map((r) => r.month)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    const y = periodWindow(monthly, "2026-11-01", "12M");
    expect(y.rows).toHaveLength(10);
    expect(y.label).toBe("Jan to Oct 2026 (10 full months, fewer than 12 so far)");
  });

  it("1M is the open month so far; with nothing booked yet it is empty, not zeros", () => {
    const empty = periodWindow([...base, row("2026-11", 0)], "2026-11-01", "1M");
    expect(empty.empty).toBe(true);
    expect(empty.label).toBe("Nothing booked yet this month");
    expect(periodMonths(base, "2026-11-01", "1M")).toEqual([]); // no row at all
    const mid = periodWindow([...base, row("2026-11", 350)], "2026-11-15", "1M");
    expect(mid.rows.map((r) => r.month)).toEqual(["2026-11"]);
    expect(mid.label).toBe("This month so far");
  });

  it("mid-month as-of never counts the open month as full", () => {
    const monthly = [...base, row("2026-11", 350)];
    expect(periodMonths(monthly, "2026-11-15", "3M").map((r) => r.month)).toEqual(["2026-08", "2026-09", "2026-10"]);
    const ytd = periodWindow(monthly, "2026-11-15", "YTD");
    expect(ytd.rows).toHaveLength(11);
    expect(ytd.label).toBe("Year to date, through Nov 15, 2026");
  });

  it("a January as-of crosses the year boundary", () => {
    const monthly = [row("2025-10", 100), row("2025-11", 200), row("2025-12", 300), row("2026-01", 50)];
    const w = periodWindow(monthly, "2026-01-10", "3M");
    expect(w.rows.map((r) => r.month)).toEqual(["2025-10", "2025-11", "2025-12"]);
    expect(w.label).toBe("Oct to Dec 2025 (3 full months)");
    expect(periodMonths(monthly, "2026-01-10", "YTD").map((r) => r.month)).toEqual(["2026-01"]);
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-03", -14)).toBe("2025-01");
  });

  it("fewer months than N available, and none", () => {
    const young = [row("2026-09", 500), row("2026-10", 600)];
    const w = periodWindow(young, "2026-11-02", "6M");
    expect(w.rows).toHaveLength(2);
    expect(w.label).toBe("Sep to Oct 2026 (2 full months, fewer than 6 so far)");
    const none = periodWindow([row("2026-10", 600)], "2026-10-03", "3M");
    expect(none.empty).toBe(true);
    expect(none.label).toBe("No full months yet");
    expect(periodWindow([], "2026-10-03", "3M").empty).toBe(true);
  });

  it("notes the quarterly payroll swing only for a window under 3 months that holds wages", () => {
    const monthly = [...base, row("2026-11", 350)];
    expect(payrollSwingNote(periodMonths(monthly, "2026-10-10", "1M"), "1M")).toBe(""); // October holds no wages
    expect(payrollSwingNote([row("2026-09", -1, 11381.25, 3125)], "1M")).toBe("Payroll is paid quarterly, so single months swing; use 3M or longer.");
    expect(payrollSwingNote(periodMonths(monthly, "2026-12-01", "YTD").slice(-2), "YTD")).toBe("");
    expect(payrollSwingNote([row("2026-08", 1, 100), row("2026-09", 1, 100)], "YTD")).not.toBe(""); // January to February of a young year
    expect(payrollSwingNote([row("2026-09", -1, 11381.25)], "3M")).toBe(""); // a short 3M is a short ledger, not a short window
  });

  it("the chart plots the window's full months plus the open month, with both profit lines", () => {
    const monthly = [...base, row("2026-11", 350)];
    const pts = profitPoints(monthly, "2026-11-15", "3M");
    expect(pts.map((p) => [p.month, p.open])).toEqual([["2026-08", false], ["2026-09", false], ["2026-10", false], ["2026-11", true]]);
    expect(pts[1]).toMatchObject({ after: -17140.04, before: -2633.79 }); // -17140.04 + 11381.25 + 3125
    expect(profitPoints(monthly, "2026-11-15", "1M").map((p) => p.month)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
    // nothing booked yet in November: no open point, so the line never ends in a fake zero
    expect(profitPoints([...base, row("2026-11", 0)], "2026-11-01", "3M").map((p) => p.month)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(profitPoints(monthly, "2026-11-15", "YTD").at(-1)).toMatchObject({ month: "2026-11", open: true });
  });
});
