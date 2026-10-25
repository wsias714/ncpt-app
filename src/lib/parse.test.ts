import { describe, expect, it } from "vitest";
import {
  UNLABELED, customerCode, daysBetween, money, parseClose, parseDashboard, parseInvoices, toNumber, totalOpen,
} from "./parse.ts";
import { closeFixture, dashboardFixture, invoicesFixture } from "./fixtures.ts";

describe("toNumber", () => {
  it("handles numbers, formatted strings and parentheses", () => {
    expect(toNumber(12.5)).toBe(12.5);
    expect(toNumber("$1,234.50")).toBe(1234.5);
    expect(toNumber("(10.00)")).toBe(-10);
    expect(toNumber("-3")).toBe(-3);
    expect(toNumber("")).toBeNull();
    expect(toNumber("n/a")).toBeNull();
    expect(toNumber(undefined)).toBeNull();
  });
});

describe("parseDashboard", () => {
  it("reads the labelled rows", () => {
    const d = parseDashboard(dashboardFixture);
    expect(d.asOf).toBe("2030-03-15");
    expect(d.cash).toBe(10000.5);
    expect(d.card).toBe(250);
    expect(d.ar).toBe(1500);
    expect(d.ytdNetCash).toBe(4200);
    expect(d.ytdNetAccrual).toBe(4700);
    expect(d.lastClosedMonth).toBe("2030-01");
    expect(d.entriesToReview).toBe(3);
    expect(d.closeBlockers).toEqual(["2030-02: bank rec off by 12.00", "2030-02: payroll residue"]);
  });
  it("treats 'none' blockers as empty and survives an empty grid", () => {
    expect(parseDashboard([["NCPT Books", "as of 2030-03-15"], ["Close blockers", "none"]]).closeBlockers).toEqual([]);
    const e = parseDashboard([]);
    expect(e.cash).toBeNull();
    expect(e.closeBlockers).toEqual([]);
  });
});

describe("parseClose", () => {
  it("reads month rows and the AR difference", () => {
    const c = parseClose(closeFixture);
    expect(c.months.map((m) => m.month)).toEqual(["2030-01", "2030-02"]);
    expect(c.months[0]).toMatchObject({ status: "LOCKED", locked: true, blockers: [] });
    expect(c.months[1]).toMatchObject({ status: "BLOCKED", locked: false });
    expect(c.months[1].blockers).toEqual(["bank rec off by 12.00"]);
    expect(c.arDifference).toBe(0);
  });
});

describe("parseInvoices", () => {
  const items = parseInvoices(invoicesFixture, "2030-03-15");
  it("keeps only open invoices, oldest first", () => {
    expect(items.map((i) => i.number)).toEqual(["9001", "9003"]);
    expect(items[0]).toMatchObject({ code: "Customer A", amount: 900, ageDays: 73 });
    expect(totalOpen(items)).toBe(1500);
  });
  it("never passes through a customer name", () => {
    expect(JSON.stringify(items)).not.toContain("Zed");
    expect(items[1].code).toBe(UNLABELED);
  });
  it("returns nothing when headers are missing", () => {
    expect(parseInvoices([["x", "y"]], "2030-03-15")).toEqual([]);
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
