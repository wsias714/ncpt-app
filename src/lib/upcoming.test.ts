import { describe, expect, it } from "vitest";
import golden from "./upcoming.golden.json";
import { demoUpcoming } from "./demo.ts";
import {
  addDays, blockedReason, canCreate, confirmText, dayShort, missingNote, pacificToday, parseUpcoming, soFar, timeRange, todoList,
  unlinkedLine, UPCOMING_HEAD, UP_STATES, type UpcomingRow,
} from "./upcoming.ts";

// upcoming.golden.json is the App Upcoming grid the Apps Script test writes (CFO ncpt_books/apps-script/upcoming.golden.json),
// synthetic customers only. Regenerate the copy there if the columns change.
describe("contract with the App Upcoming tab", () => {
  const grid = golden as unknown[][];
  const rows = parseUpcoming(grid);

  it("has the header the script writes", () => {
    expect(grid[0]).toEqual([...UPCOMING_HEAD]);
  });

  it("parses every row, keeping times as Pacific strings with their offset", () => {
    expect(rows).toHaveLength(grid.length - 1);
    const c = rows.find((r) => r.code === "Customer C")!;
    expect(c).toMatchObject({ billing: "at_visit", state: "READY", amount: 200, hours: 1, visits: 1, invoiceDate: "2026-11-17" });
    expect(c.start).toBe("2026-11-17T10:00-08:00");
    const m = rows.find((r) => r.billing === "monthly")!;
    expect(m).toMatchObject({ code: "Customer B", state: "UPCOMING", visits: 3, hours: 4.5, amount: 1012.5, invoiceDate: "2026-11-01" });
    for (const r of rows) {
      expect(UP_STATES).toContain(r.state);
      if (r.state !== "UNLINKED") expect(r.code).toMatch(/^Customer [A-Z]$/);
      if (r.state !== "UNLINKED") expect(r.fingerprint).toMatch(/^[0-9a-f]{24}$/);
    }
  });

  it("carries no names or emails", () => {
    expect(JSON.stringify(grid)).not.toMatch(/@/);
  });

  it("only a READY row can be created", () => {
    expect(rows.filter(canCreate).map((r) => r.code).sort()).toEqual(["Customer A", "Customer C"]);
    expect(rows.filter((r) => r.state === "UPCOMING").every((r) => !canCreate(r))).toBe(true);
  });

  it("builds the 7-day list: two days of visits, the monthly customer, and an unlinked count", () => {
    const list = todoList(rows, "2026-11-17");
    expect(list.groups.map((g) => g.key)).toEqual(["2026-11-17", "2026-11-18", "monthly"]);
    expect(list.groups[0].rows.map((r) => r.code)).toEqual(["Customer C", "Customer A"]); // 10:00 then 18:00
    expect(list.groups[0].label).toBe("Today, Tue 11/17");
    expect(list.groups[1].label).toBe("Tomorrow, Wed 11/18");
    expect(list.unlinked).toBe(1);
    expect(list.readyCount).toBe(2);
    // 11/24 is the eighth day: not in the window yet
    expect(list.groups.flatMap((g) => g.rows).some((r) => r.start.startsWith("2026-11-24"))).toBe(false);
    expect(list.groups.flatMap((g) => g.rows).some((r) => r.state === "UNLINKED")).toBe(false);
  });
});

const row = (p: Partial<UpcomingRow>): UpcomingRow => ({
  key: "V-1", code: "Customer A", billing: "per_visit", start: "2030-03-12T09:00-08:00", end: "2030-03-12T10:30-08:00",
  hours: 1.5, visits: 1, amount: 200, invoiceDate: "2030-03-12", readyAt: "2030-03-12T10:30-08:00", state: "READY", number: "", note: "",
  fingerprint: "fp", published: "", ...p,
});

describe("parseUpcoming", () => {
  const head = [...UPCOMING_HEAD];
  it("is empty for a missing or header-only tab", () => {
    expect(parseUpcoming([])).toEqual([]);
    expect(parseUpcoming([head])).toEqual([]);
  });
  it("reads by header name, tolerates reordered columns, and drops unknown states and non-code rows", () => {
    const g = [
      ["State", "Code", "Key", "Amount", "Fingerprint"],
      ["READY", "Customer A", "k1", "$1,200.50", "f1"],
      ["MYSTERY", "Customer A", "k2", "5", "f2"],
      ["READY", "Doe, Pat", "k3", "5", "f3"], // not shaped like a code: never shown
      ["unlinked", "", "UNLINKED", "", ""],
    ];
    const rows = parseUpcoming(g);
    expect(rows.map((r) => [r.key, r.state])).toEqual([["k1", "READY"], ["UNLINKED", "UNLINKED"]]);
    expect(rows[0].amount).toBe(1200.5);
  });
  it("a READY row without a fingerprint cannot be created", () => {
    expect(canCreate(row({ fingerprint: "" }))).toBe(false);
    expect(canCreate(row({ key: "" }))).toBe(false);
    expect(canCreate(row({}))).toBe(true);
    for (const s of UP_STATES.filter((s) => s !== "READY")) expect(canCreate(row({ state: s }))).toBe(false);
  });
});

describe("display helpers", () => {
  it("formats the visit time as read on the calendar", () => {
    expect(timeRange("2030-03-12T09:00-08:00", "2030-03-12T10:30-08:00")).toBe("9:00-10:30");
    expect(timeRange("2030-03-12T18:00-08:00", "2030-03-12T19:00-08:00")).toBe("6:00-7:00 pm");
    expect(timeRange("2030-03-12T11:30-08:00", "2030-03-12T13:00-08:00")).toBe("11:30 am-1:00 pm");
    expect(timeRange("2030-03-12T12:00-08:00", "2030-03-12T13:00-08:00")).toBe("12:00-1:00 pm");
    expect(timeRange("", "")).toBe("");
  });
  it("words the confirm sheet question", () => {
    expect(confirmText(row({ start: "2026-11-03T09:00-08:00", end: "2026-11-03T10:30-08:00", hours: 1.5, amount: 200 }))).toBe("Bill Tue 11/3, 9:00-10:30, 1.5 h, $200?");
    expect(confirmText(row({ billing: "monthly", invoiceDate: "2026-11-01", visits: 5, hours: 7.5, amount: 1687.5 }))).toBe("Bill November: 5 visits, 7.5 h, $1,687.50?");
  });
  it("sums a monthly row so far", () => {
    expect(soFar(row({ visits: 3, hours: 4.5, amount: 1012.5 }))).toBe("3 visits, 4.5 h, $1,012.50 so far");
    expect(soFar(row({ visits: 1, hours: 1, amount: 200 }))).toBe("1 visit, 1 h, $200 so far");
  });
  it("warns when the note says there is no visit note yet", () => {
    expect(missingNote(row({ note: "No visit note yet" }))).toBe(true);
    expect(missingNote(row({ note: "2 without a visit note yet" }))).toBe(true);
    expect(missingNote(row({ note: "" }))).toBe(false);
  });
  it("says why the button is unavailable", () => {
    expect(blockedReason(row({ state: "READY" }))).toBe("");
    expect(blockedReason(row({ state: "UPCOMING" }))).toBe("visit not over yet");
    expect(blockedReason(row({ state: "UPCOMING", billing: "monthly", readyAt: "2030-03-31T10:00-08:00" }))).toBe("month not over yet; ready 3/31");
    expect(blockedReason(row({ state: "WAVE" }))).toBe("bill in Wave");
    expect(blockedReason(row({ state: "DRAFTED", number: "9101" }))).toBe("invoice 9101 drafted");
    expect(blockedReason(row({ state: "PAID", number: "9101" }))).toBe("invoice 9101 paid");
  });
  it("counts unlinked events in one line", () => {
    expect(unlinkedLine(0)).toBe("");
    expect(unlinkedLine(1)).toBe("1 calendar event not linked to a customer");
    expect(unlinkedLine(3)).toBe("3 calendar events not linked to a customer");
  });
  it("does dates in Pacific time", () => {
    expect(pacificToday(new Date("2026-11-02T03:00:00Z"))).toBe("2026-11-01"); // 7 pm Sunday in Pacific
    expect(pacificToday(new Date("2026-11-02T09:00:00Z"))).toBe("2026-11-02");
    expect(addDays("2026-11-29", 3)).toBe("2026-12-02");
    expect(dayShort("2026-11-03")).toBe("Tue 11/3");
  });
});

describe("todoList", () => {
  const today = "2030-03-12";
  it("puts passed, unbilled visits first, then days, then months; leaves WAVE past and far-out rows out", () => {
    const rows = [
      row({ key: "a", start: "2030-03-10T09:00-08:00", state: "READY" }),
      row({ key: "b", start: "2030-03-10T11:00-08:00", state: "SENT", number: "9001" }), // finished and earlier: not a to-do
      row({ key: "c", start: "2030-03-14T09:00-08:00", state: "UPCOMING" }),
      row({ key: "d", start: "2030-03-12T09:00-08:00", state: "WAVE" }),
      row({ key: "e", start: "2030-03-19T09:00-08:00", state: "UPCOMING" }), // day 8
      row({ key: "m", billing: "monthly", start: "2030-03-04T09:00-08:00", invoiceDate: "2030-03-01", state: "UPCOMING" }),
      row({ key: "u", code: "", state: "UNLINKED", visits: 2 }),
    ];
    const list = todoList(rows, today);
    expect(list.groups.map((g) => [g.key, g.rows.map((r) => r.key)])).toEqual([
      ["earlier", ["a"]], ["2030-03-12", ["d"]], ["2030-03-14", ["c"]], ["monthly", ["m"]],
    ]);
    expect(list.unlinked).toBe(2);
    expect(list.readyCount).toBe(1);
  });
  it("is empty for no rows", () => {
    expect(todoList([], today)).toEqual({ groups: [], unlinked: 0, readyCount: 0 });
  });
});

describe("demo App Upcoming", () => {
  const rows = parseUpcoming(demoUpcoming("2030-03-15"));
  it("covers every State with made-up codes", () => {
    expect(new Set(rows.map((r) => r.state))).toEqual(new Set(UP_STATES));
    expect(JSON.stringify(demoUpcoming("2030-03-15"))).not.toMatch(/@/);
  });
});
