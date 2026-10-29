import { describe, expect, it } from "vitest";
import { parseDeadlines } from "./deadlines.ts";
import { deadlinesFixture, kitDeadlinesFixture, kitsFixture } from "./fixtures.ts";
import { deadlinesForKit, failingTies, kitForDeadline, kitIdFor, parseKits, yearEndTies } from "./kits.ts";

const kits = parseKits(kitsFixture);
const deadlines = parseDeadlines([...deadlinesFixture, ...kitDeadlinesFixture.slice(1)], "2026-10-29");
const k = (id: string, period: string) => kits.find((x) => x.id === id && x.period === period)!;

describe("parseKits", () => {
  it("is empty for a missing tab", () => {
    expect(parseKits([])).toEqual([]);
    expect(parseKits([["Kit", "Period"]])).toEqual([]);
  });
  it("groups rows by kit and period, in published order", () => {
    expect(kits.map((x) => `${x.id} ${x.period}`)).toEqual(["F1 2026Q4", "F3 2026", "F4 2026", "C1 2026Q4", "TIES 2026"]);
  });
  it("reads the kit header row: title, portal, fingerprint, status", () => {
    expect(k("F1", "2026Q4")).toMatchObject({ title: "Form 941", portal: "https://www.taxbandits.com/", fingerprint: "fp0f1", status: "check" });
    expect(k("F3", "2026").status).toBe("verify");
    expect(k("F4", "2026").status).toBe("blocked");
  });
  it("keeps the fields in Order with the line, source and a copyable value", () => {
    const f = k("F1", "2026Q4").fields;
    expect(f.map((x) => x.line)).toEqual(["1", "2", "3", "4", "5a col 2", "13"]);
    expect(f[1]).toMatchObject({ label: "Wages, tips and other compensation", display: "12,500.00", copy: "12500.00", source: "tracker Gross Payroll (row 4)" });
    expect(f[2].copy).toBe("586.50");
    expect(f[3]).toMatchObject({ display: "unchecked", copy: "unchecked" });
  });
  it("prints counts as whole numbers and keeps text values as published", () => {
    expect(k("F1", "2026Q4").fields[0]).toMatchObject({ display: "1", copy: "1" });
    expect(k("C1", "2026Q4").fields[0]).toMatchObject({ display: "1 / 1 / 1", copy: "1 / 1 / 1" });
  });
  it('does not mistake "Total payments to all employees" for a head count', () => {
    expect(k("F3", "2026").fields[1]).toMatchObject({ display: "52,500.00", copy: "52500.00" });
  });
  it("orders fields by Order even when rows arrive shuffled", () => {
    const shuffled = [kitsFixture[0], ...kitsFixture.slice(1).reverse()];
    expect(parseKits(shuffled).find((x) => x.id === "F1")!.fields.map((x) => x.line)).toEqual(["1", "2", "3", "4", "5a col 2", "13"]);
  });
  it("reads tie-outs with ok / FAIL / n/a, and verify and blocked notes", () => {
    expect(k("F1", "2026Q4").ties.map((t) => [t.name, t.status])).toEqual([["941_5A_EE_ER_SS", "ok"], ["941_13_VS_12", "FAIL"]]);
    expect(k("F1", "2026Q4").ties[1]).toMatchObject({ value: "2499 / 2500", note: "a difference shows as a balance due or overpayment" });
    expect(failingTies(k("F1", "2026Q4"))).toHaveLength(1);
    expect(k("F3", "2026").verify).toHaveLength(1);
    expect(k("F4", "2026").blocked).toEqual(["Q4 payroll has not been run"]);
  });
  it("keeps the year-end ties as the TIES kit", () => {
    const [t] = yearEndTies(kits);
    expect(t.ties.map((x) => x.status)).toEqual(["ok", "FAIL", "n/a"]);
    expect(t.fields).toEqual([]);
  });
});

describe("kit to deadline mapping", () => {
  it("matches a deadline by Id and Period", () => {
    expect(kitForDeadline(kits, "F1", "2026Q4")?.title).toBe("Form 941");
    expect(kitForDeadline(kits, "F1", "2026Q3")).toBeUndefined();
    expect(kitForDeadline(kits, "F2", "2026Q4")).toBeUndefined();
  });
  it("DE 9 and DE 9C are one kit (C1) for two deadline items", () => {
    expect(kitIdFor("C2")).toBe("C1");
    expect(kitForDeadline(kits, "C2", "2026Q4")?.id).toBe("C1");
    expect(deadlinesForKit(k("C1", "2026Q4"), deadlines).map((d) => d.id)).toEqual(["C1", "C2"]);
  });
  it("finds the deadline rows a kit can be recorded against", () => {
    expect(deadlinesForKit(k("F1", "2026Q4"), deadlines).map((d) => d.id)).toEqual(["F1"]);
    expect(deadlinesForKit(k("F3", "2026"), deadlines).map((d) => d.id)).toEqual(["F3"]);
  });
});
