import { describe, expect, it } from "vitest";
import { payrollBlockedFixture, payrollFixture } from "./fixtures.ts";
import { approveBlockedWhy, approvalRow, blockers, canApproveRun, copyAmount, parsePayroll } from "./payroll.ts";

const run = parsePayroll(payrollFixture)!;
const blocked = parsePayroll(payrollBlockedFixture)!;

describe("parsePayroll", () => {
  it("is null for a missing or empty tab", () => {
    expect(parsePayroll([])).toBeNull();
    expect(parsePayroll([["Section", "Key", "Label", "Amount", "Due", "Status", "Detail"]])).toBeNull();
  });
  it("reads the run amounts, with the Q4 made-up numbers", () => {
    expect(run.ref).toBe("2026Q4");
    const a = Object.fromEntries(run.amounts.map((x) => [x.key, x.amount]));
    expect(a).toMatchObject({ gross: 12500, fed_pit: 586.5, ca_pit: 327.91, edd: 490.41, eftps: 2499 });
    expect(run.amounts).toHaveLength(15);
  });
  it("reads checks with their status", () => {
    expect(run.checks).toHaveLength(11);
    expect(run.checks.find((c) => c.id === "DE4_SIGNED")!.status).toBe("warn");
    expect(blockers(run)).toEqual([]);
    expect(blockers(blocked).map((c) => c.id)).toEqual(["FED_PIT_EMPTY"]);
  });
  it("reads legs: expected, clear-by date, status and the cleared details from the JSON", () => {
    const [asc, cash, , edd] = run.legs;
    expect(asc).toMatchObject({ key: "ascensus", expected: 3125, clearBy: "2026-12-31", status: "matched", clearedOn: "2026-12-31", clearedAmount: 3125 });
    expect(cash).toMatchObject({ status: "pending", clearedAmount: null, portal: "https://bank.example.com/" });
    expect(edd).toMatchObject({ status: "mismatch", clearedAmount: 490.14, diff: -0.27 });
  });
  it("survives a malformed leg detail", () => {
    const g = [["Section", "Key", "Label", "Amount", "Due", "Status", "Detail"], ["leg", "eftps", "EFTPS", 100, "2027-01-15", "bogus", "{not json"]];
    expect(parsePayroll(g)!.legs[0]).toMatchObject({ status: "pending", clearedOn: "", portal: "", expected: 100 });
  });
  it("reads filing lines (amounts and text-only rows) and the meta rows", () => {
    expect(run.filing.find((f) => f.key === "941.3")).toMatchObject({ amount: 586.5, due: "2027-02-01" });
    expect(run.filing.find((f) => f.key === "de9c.wage_plan_code")).toMatchObject({ amount: null, detail: "S" });
    expect(run.fingerprint).toBe("a1b2c3d4e5f60718293a4b5c");
    expect(JSON.parse(run.amountsJson)).toMatchObject({ gross: 12500, ca_pit: 327.91 });
    expect(run.approval).toBe("none");
    expect(run.runBy).toBe("2026-12-22");
    expect(run.meta.map((m) => m.key)).toEqual(["deferral_room", "cum_gross_before"]);
  });
  it("reads each approval state and defaults an unknown one to none", () => {
    const withState = (s: string) => parsePayroll(payrollFixture.map((r) => (r[1] === "approval" ? [...r.slice(0, 5), s, "APPROVE Julie 2026-12-20"] : r)))!;
    for (const s of ["approved", "stale", "none", "revoked"]) expect(withState(s).approval).toBe(s);
    expect(withState("???").approval).toBe("none");
    expect(withState("approved").approvalDetail).toBe("APPROVE Julie 2026-12-20");
  });
  it("reads an unavailable tracker (meta rows only)", () => {
    const g = [["Section", "Key", "Label", "Amount", "Due", "Status", "Detail"],
      ["meta", "ref", "Quarter", "", "", "", "2026Q4"], ["meta", "tracker", "Payroll tracker", "", "", "unavailable", "tracker not found"],
      ["meta", "can_approve", "Can approve", "", "", "no", "payroll tracker unavailable"]];
    const r = parsePayroll(g)!;
    expect(r).toMatchObject({ ref: "2026Q4", trackerOk: false, trackerWhy: "tracker not found", amounts: [] });
    expect(canApproveRun(r)).toBe(false);
    expect(approveBlockedWhy(r)).toBe("tracker not found");
  });
});

describe("canApproveRun", () => {
  it("is on for a clean run (a warning does not block)", () => {
    expect(canApproveRun(run)).toBe(true);
    expect(approveBlockedWhy(run)).toBe("");
  });
  it("is off while a check blocks, and says which", () => {
    expect(canApproveRun(blocked)).toBe(false);
    expect(approveBlockedWhy(blocked)).toBe("Fix first: Federal PIT row filled.");
  });
  it("is off if Python says no, or the sheet is incomplete", () => {
    expect(canApproveRun({ ...run, canApprove: false })).toBe(false);
    expect(canApproveRun({ ...run, fingerprint: "" })).toBe(false);
    expect(canApproveRun({ ...run, amountsJson: "" })).toBe(false);
    expect(canApproveRun({ ...run, ref: "" })).toBe(false);
    expect(canApproveRun({ ...run, amounts: [] })).toBe(false);
  });
});

describe("approvalRow", () => {
  const now = new Date("2026-12-20T09:00:00Z");
  it("APPROVE freezes the amounts and fingerprint: [Kind, Ref, Fingerprint, Amounts (JSON), Action, Who, When]", () => {
    const row = approvalRow("APPROVE", run, "Julie", now);
    expect(row).toEqual(["PAYROLL_RUN", "2026Q4", "a1b2c3d4e5f60718293a4b5c", run.amountsJson, "APPROVE", "Julie", "2026-12-20T09:00:00.000Z"]);
    expect(row).toHaveLength(7);
    expect(JSON.parse(row[3])).toMatchObject({ gross: 12500, fed_pit: 586.5, ca_pit: 327.91, edd: 490.41, eftps: 2499 });
  });
  it("REVOKE carries the fingerprint but no amounts", () => {
    expect(approvalRow("REVOKE", run, "Wade", now)).toEqual(["PAYROLL_RUN", "2026Q4", "a1b2c3d4e5f60718293a4b5c", "", "REVOKE", "Wade", "2026-12-20T09:00:00.000Z"]);
  });
});

describe("copyAmount", () => {
  it("is the plain two-decimal number for a portal", () => {
    expect(copyAmount(12500)).toBe("12500.00");
    expect(copyAmount(586.5)).toBe("586.50");
    expect(copyAmount(0)).toBe("0.00");
  });
});
