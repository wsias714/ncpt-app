import { describe, expect, it } from "vitest";
import {
  beforePayroll, payrollInPnl, NO_FILTER, UNLABELED, accountPickerOrder, customerCode, daysBetween, filterTransactions, invoiceStats, isPending,
  latestDecisions, money, needsBooking, parseAccounts, parseAppInvoices, parseBalanceSheet, parseDecisions,
  parseMonthly, parsePnl, parseSummary, parseTransactions, recentTransactions, toIsoDate, toNumber, totalOpen,
  txCategories, txMonths, wagesTotal,
} from "./parse.ts";
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
    expect(beforePayroll(s.profitLastMonth, s.payrollLastMonth)).toBe(5900);
    expect(beforePayroll(s.profitYtd, wagesTotal(s))).toBe(14650);
    expect(beforePayroll(null, 5)).toBeNull();
    expect(parseMonthly(monthlyFixture).map((r) => r.payroll)).toEqual([3050, 2500, 0]);
    // fixture account 6200 stands in for a payroll code here: 600 in the YTD cash column (index 3)
    expect(payrollInPnl(parsePnl(pnlFixture), 3)).toBe(600);
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
  it("lists months, categories and the last 7 days", () => {
    expect(txMonths(txs)).toEqual(["2030-03", "2030-02", "2030-01"]);
    expect(txCategories(txs).map((c) => c.code)).toEqual(["4000", "6100", "6200", "7000"]);
    expect(recentTransactions(txs, "2030-03-15").map((t) => t.entry)).toEqual(["bank:t6", "bank:t5", "bank:t4"]);
  });
});

describe("parseMonthly", () => {
  it("sorts oldest first", () => {
    const m = parseMonthly(monthlyFixture);
    expect(m.map((r) => r.month)).toEqual(["2030-01", "2030-02", "2030-03"]);
    expect(m[2]).toMatchObject({ income: 2000, netCash: 1200, cashEnd: 10000.5, arEnd: 1500, cardEnd: 250 });
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
