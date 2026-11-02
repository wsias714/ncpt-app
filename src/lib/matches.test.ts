import { describe, expect, it, vi } from "vitest";
import golden from "./matches.golden.json";
import { demoMatches } from "./demo.ts";
import {
  approveQuestion, invoiceWords, latestDecisions, matchAnswer, matchCardState, MATCHES_HEAD, matchesWaiting, parseAlternatives,
  parseDecisions, parseMatches, proposedMatches, REJECT_QUESTION, type Grid, type MatchChoice,
} from "./parse.ts";
import { AuthExpiredError, createReader, matchDecisionRow, tabUrl } from "./sheets.ts";

// matches.golden.json is the App Matches grid shape the Python side publishes (made-up codes and numbers only).
describe("contract with the App Matches tab", () => {
  const grid = golden as unknown as Grid;
  const ms = parseMatches(grid);

  it("has the header Python writes", () => {
    expect(grid[0]).toEqual([...MATCHES_HEAD]);
  });

  it("parses every row", () => {
    expect(ms).toHaveLength(grid.length - 1);
    expect(ms[0]).toEqual({
      id: "m-2026-10-30-5063", date: "2026-10-30", amount: 5063, rail: "zelle", confidence: "high", code: "Customer C", invoices: ["3539"],
      invoiceTotal: 5063, variance: "", status: "proposed", why: "Amount equals the invoice total and the payer matches earlier payments.", alternatives: [],
    });
    expect(ms[1]).toMatchObject({ rail: "mobile_deposit", confidence: "medium", invoices: ["3540", "3541"], invoiceTotal: 6300 });
    expect(ms[1].alternatives).toEqual([{ code: "Customer D", invoices: ["3542"] }]);
    expect(ms[2]).toMatchObject({ confidence: "low", variance: "+0.50", amount: 200.5 });
    expect(ms[2].alternatives).toEqual([{ code: "Customer E", invoices: ["3543"] }, { code: "Customer A", invoices: ["3544"] }]);
    expect(ms[4].code).toBe(""); // not tied to one customer
  });

  it("lists only the proposed ones: a validated match is not waiting for an OK", () => {
    expect(proposedMatches(ms).map((m) => m.id)).toEqual(["m-2026-10-30-5063", "m-2026-10-29-6300", "m-2026-10-28-200", "m-2026-10-26-75"]);
    expect(ms.find((m) => m.status === "validated")?.id).toBe("m-2026-10-27-900");
  });

  it("carries no names or emails", () => {
    expect(JSON.stringify(grid)).not.toMatch(/@/);
    for (const m of ms) if (m.code) expect(m.code).toMatch(/^Customer [A-Z]$/);
  });

  it("reads by header, so a reordered or older grid still parses; junk rails and confidences fall back safely", () => {
    const g: Grid = [["Amount", "Match", "Confidence", "Rail", "Invoices", "Status"], [10, "x1", "SURE", "cash", "7", "Proposed"]];
    expect(parseMatches(g)).toMatchObject([{ id: "x1", amount: 10, confidence: "low", rail: "other", invoices: ["7"], status: "proposed", code: "", alternatives: [] }]);
    expect(parseMatches([])).toEqual([]);
    expect(parseMatches([[...MATCHES_HEAD]])).toEqual([]);
    expect(parseMatches([[...MATCHES_HEAD], ["", "2026-10-01", 5]])).toEqual([]); // no id
  });
});

describe("alternatives and wording", () => {
  it("splits 'Customer D: 3541; Customer A: 3540+3542' and drops broken pieces", () => {
    expect(parseAlternatives("Customer D: 3541; Customer A: 3540+3542")).toEqual([
      { code: "Customer D", invoices: ["3541"] }, { code: "Customer A", invoices: ["3540", "3542"] },
    ]);
    expect(parseAlternatives("")).toEqual([]);
    expect(parseAlternatives("Pat Doe: 3541; Customer B:")).toEqual([]);
  });
  it("words the invoices and the confirm questions", () => {
    const ms = parseMatches(golden as unknown as Grid);
    expect(invoiceWords(["3539"])).toBe("invoice 3539");
    expect(invoiceWords(["3540", "3541"])).toBe("invoices 3540 and 3541");
    expect(invoiceWords(["1", "2", "3"])).toBe("invoices 1, 2 and 3");
    expect(approveQuestion(ms[0])).toBe("Mark invoice 3539 paid by this $5,063.00 deposit?");
    expect(approveQuestion(ms[1])).toBe("Mark invoices 3540 and 3541 paid by this $6,300.00 deposit?");
    expect(REJECT_QUESTION).toBe("Reject this match? It will propose the next best one.");
  });
});

describe("the decision row", () => {
  const now = new Date("2030-03-15T10:00:00Z");
  it("is [match:<id>, APPROVE|REJECT, note, who, when] with no Status column", () => {
    expect(matchDecisionRow("m-2026-10-30-5063", "APPROVE", "", "Julie", now)).toEqual(["match:m-2026-10-30-5063", "APPROVE", "", "Julie", "2030-03-15T10:00:00.000Z"]);
    const rej = matchDecisionRow(" m1 ", "REJECT", " wrong patient ", "Wade", now);
    expect(rej).toEqual(["match:m1", "REJECT", "wrong patient", "Wade", "2030-03-15T10:00:00.000Z"]);
    expect(rej).toHaveLength(5);
  });
  it("appends to App Decisions A:E through the same writer", async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    const r = createReader(() => "tok", f, "SHEET");
    await r.appendDecision(matchDecisionRow("m1", "APPROVE", "", "Wade", now));
    const [url, init] = f.mock.calls[0] as unknown as [string, { method: string; body: string }];
    expect(url).toContain("App%20Decisions!A%3AE:append");
    expect(JSON.parse(init.body)).toEqual({ values: [["match:m1", "APPROVE", "", "Wade", "2030-03-15T10:00:00.000Z"]] });
  });
});

describe("readMatches tolerates a missing tab", () => {
  const res = (status: number, body: unknown = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  it("returns the grid, or null for a missing tab, a server error or a network failure", async () => {
    const g = [["Match"], ["m1"]];
    expect(await createReader(() => "t", async () => res(200, { values: g }), "S").readMatches()).toEqual(g);
    expect(await createReader(() => "t", async () => res(200, {}), "S").readMatches()).toEqual([]);
    expect(await createReader(() => "t", async () => res(400), "S").readMatches()).toBeNull();
    expect(await createReader(() => "t", async () => res(500), "S").readMatches()).toBeNull();
    expect(await createReader(() => "t", async () => { throw new Error("offline"); }, "S").readMatches()).toBeNull();
    const f = vi.fn(async () => res(200, { values: g }));
    await createReader(() => "t", f, "S").readMatches();
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe(tabUrl("S", "App Matches"));
  });
  it("still reports an expired sign-in", async () => {
    await expect(createReader(() => "t", async () => res(401), "S").readMatches()).rejects.toBeInstanceOf(AuthExpiredError);
    await expect(createReader(() => null, async () => res(200), "S").readMatches()).rejects.toBeInstanceOf(AuthExpiredError);
  });
});

describe("card state", () => {
  const ms = parseMatches(demoMatches("2030-03-15"));
  const none = new Map<string, MatchChoice>();
  const latest = latestDecisions(parseDecisions([["Entry", "Account", "Note", "Who", "When", "Status"], ["match:demo-m2", "REJECT", "", "Wade", "2030-03-14T00:00:00Z", ""]]));

  it("an unanswered card has live buttons; an answered one has none and says what happens next", () => {
    expect(matchCardState(undefined)).toEqual({ answered: false, buttonsDisabled: false, message: "" });
    expect(matchCardState("APPROVE")).toEqual({ answered: true, buttonsDisabled: true, message: "Approved. It updates within the hour (Refresh)" });
    expect(matchCardState("REJECT").message).toMatch(/^Rejected\./);
  });
  it("this session's answer wins, else an earlier App Decisions row for match:<id>", () => {
    expect(matchAnswer("demo-m1", none, latest)).toBeUndefined();
    expect(matchAnswer("demo-m1", new Map([["demo-m1", "APPROVE" as const]]), latest)).toBe("APPROVE");
    expect(matchAnswer("demo-m2", none, latest)).toBe("REJECT"); // answered in an earlier session, Python has not caught up
  });
  it("counts only the proposed matches still waiting (demo: two proposed and one validated)", () => {
    expect(proposedMatches(ms)).toHaveLength(2);
    expect(matchesWaiting(ms, none, new Map())).toBe(2);
    expect(matchesWaiting(ms, new Map([["demo-m1", "APPROVE" as const]]), latest)).toBe(0);
    expect(ms.map((m) => m.confidence)).toEqual(["high", "low", "high"]);
  });
});
