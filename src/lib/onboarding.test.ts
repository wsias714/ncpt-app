import { describe, expect, it } from "vitest";
import { onboardingLine, parseOnboarding } from "./onboarding.ts";

const grid = [["Code", "Status", "Needs"], ["Customer B", "New", "confirm new client"], ["Customer C", "Staged", "rate and billing; folder"], ["", "", ""], ["Customer D", "Active", ""]];

describe("onboarding", () => {
  it("lists only clients with something to do, in order, codes only", () => {
    const rows = parseOnboarding(grid);
    expect(rows.map((r) => r.code)).toEqual(["Customer B", "Customer C"]);
    expect(rows[1].needs).toEqual(["rate and billing", "folder"]);
  });
  it("an empty or headerless tab shows nothing", () => {
    expect(parseOnboarding([])).toEqual([]);
    expect(parseOnboarding([["x"]])).toEqual([]);
  });
  it("the line uses the label function, so names appear only when names are on", () => {
    const [r] = parseOnboarding(grid);
    expect(onboardingLine(r, (c) => c)).toBe("Customer B (New): confirm new client");
  });
});
