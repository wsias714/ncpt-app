import { describe, expect, it } from "vitest";
import { filingRow, validateFiling, type FilingInput } from "./filings.ts";

const ok: FilingInput = { id: "F1", period: "2026Q4", confirmation: "ABC123", amount: "2,499", filedOn: "2027-01-28", method: "TaxBandits" };
const now = new Date("2027-01-28T17:00:00Z");

describe("validateFiling", () => {
  it("accepts a complete form", () => {
    expect(validateFiling(ok)).toEqual([]);
    expect(validateFiling({ ...ok, amount: "" })).toEqual([]); // the amount is optional
  });
  it("requires the confirmation number", () => {
    expect(validateFiling({ ...ok, confirmation: "  " })).toEqual(["Enter the confirmation number."]);
  });
  it('rejects a confirmation starting with "-" (the Python loader refuses it)', () => {
    expect(validateFiling({ ...ok, confirmation: "-123" })).toEqual(["The confirmation number cannot start with a minus sign."]);
  });
  it("requires an ISO date that exists", () => {
    for (const bad of ["", "1/28/2027", "2027-1-28", "2027-02-30", "yesterday"]) {
      expect(validateFiling({ ...ok, filedOn: bad })).toEqual(["Enter the filed date as YYYY-MM-DD."]);
    }
  });
  it("rejects a non-numeric amount", () => {
    expect(validateFiling({ ...ok, amount: "two grand" })).toHaveLength(1);
  });
  it("needs the Id and Period of the deadline item", () => {
    expect(validateFiling({ ...ok, id: "" })).toHaveLength(1);
    expect(validateFiling({ ...ok, period: " " })).toHaveLength(1);
  });
  it("lists every problem at once", () => {
    expect(validateFiling({ ...ok, confirmation: "", filedOn: "x", amount: "abc" })).toHaveLength(3);
  });
});

describe("filingRow", () => {
  it("is [Id, Period, Confirmation, Amount, Filed on, Method, Who, When, Note], trimmed", () => {
    const row = filingRow({ ...ok, id: " F1 ", confirmation: " ABC123 ", note: " late " }, "Julie", now);
    expect(row).toEqual(["F1", "2026Q4", "ABC123", "2499.00", "2027-01-28", "TaxBandits", "Julie", "2027-01-28T17:00:00.000Z", "late"]);
    expect(row).toHaveLength(9);
  });
  it("leaves the amount blank when there is none and keeps a leading-zero confirmation as text", () => {
    const row = filingRow({ ...ok, amount: "", confirmation: "00123" }, "Wade", now);
    expect(row[2]).toBe("00123");
    expect(row[3]).toBe("");
    expect(row[8]).toBe("");
  });
});
