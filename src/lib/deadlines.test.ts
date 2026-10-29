import { describe, expect, it } from "vitest";
import { band, dayLabel, daysLabel, groupDeadlines, nextDeadline, parseDate, parseDeadlines, weekLabel, weekStart } from "./deadlines.ts";
import { deadlinesFixture } from "./fixtures.ts";

const TODAY = "2026-10-28";
const rows = parseDeadlines(deadlinesFixture, TODAY);
const byId = (id: string) => rows.find((r) => r.id === id)!;

describe("parseDate", () => {
  it("takes ISO, ISO datetime, M/D/YYYY and serial numbers; rejects the rest", () => {
    expect(parseDate("2027-02-01")).toBe("2027-02-01");
    expect(parseDate("2027-02-01T08:00:00Z")).toBe("2027-02-01");
    expect(parseDate("2/1/2027")).toBe("2027-02-01");
    expect(parseDate("12/31/2026")).toBe("2026-12-31");
    expect(parseDate(46054)).toBe("2026-02-01");
    expect(parseDate("")).toBe("");
    expect(parseDate("soon")).toBe("");
    expect(parseDate("2/30/2027")).toBe("");
  });
});

describe("parseDeadlines", () => {
  it("parses the published rows and skips blank ones", () => {
    expect(rows).toHaveLength(11);
    expect(byId("X7")).toMatchObject({ title: "Form 941 Q4", due: "2027-02-01", rawDue: "2027-01-31", rolled: true, state: "open", method: "E-file" });
    expect(byId("X5")).toMatchObject({ state: "blocked", blocker: "Q4 payroll not run yet" });
    expect(parseDeadlines([])).toEqual([]);
    expect(parseDeadlines([["Id", "Title"], ["", ""], [], ["A", ""]])).toEqual([]);
  });
  it("recomputes days left from today, else keeps the published number", () => {
    expect(byId("X1").daysLeft).toBe(-2);
    expect(byId("X7").daysLeft).toBe(96);
    expect(parseDeadlines(deadlinesFixture, "2026-11-02").find((r) => r.id === "X3")!.daysLeft).toBe(0);
    expect(parseDeadlines(deadlinesFixture).find((r) => r.id === "X3")!.daysLeft).toBe(5);
  });
  it("tolerates text dates and numbers, and undated rows", () => {
    const g = [
      ["Id", "Title"],
      ["T1", "Text row", "NCPT", "payroll", "2026Q4", "2/1/2027", "1/31/2027", "yes", "96", "OPEN", "", "", "", "", "", ""],
      ["T2", "Serial row", "NCPT", "", "", 46054, "", "", 5, "open"],
      ["T3", "No date", "NCPT", "", "", "", "", "", "", "undated"],
      ["T4", "Odd state", "NCPT", "", "", "", "", "", "", "whatever"],
    ];
    const p = parseDeadlines(g);
    expect(p[0]).toMatchObject({ due: "2027-02-01", rawDue: "2027-01-31", rolled: true, daysLeft: 96, state: "open" });
    expect(p[1]).toMatchObject({ due: "2026-02-01", daysLeft: 5, rolled: false });
    expect(p[2]).toMatchObject({ due: "", daysLeft: null, state: "undated" });
    expect(p[3].state).toBe("undated");
  });
});

describe("band", () => {
  it("bands by days left", () => {
    expect(band(-1, "open")).toBe("overdue");
    expect(band(0, "open")).toBe("soon");
    expect(band(7, "open")).toBe("soon");
    expect(band(8, "open")).toBe("month");
    expect(band(30, "verify")).toBe("month");
    expect(band(31, "open")).toBe("later");
    expect(band(90, "open")).toBe("later");
    expect(band(91, "open")).toBe("none");
    expect(band(null, "open")).toBe("none");
  });
  it("state overrides days", () => {
    expect(band(-30, "done")).toBe("done");
    expect(band(3, "blocked")).toBe("blocked");
    expect(band(3, "exempt")).toBe("none");
    expect(band(null, "undated")).toBe("none");
  });
});

describe("dates and labels", () => {
  it("labels weeks from Monday", () => {
    expect(weekStart("2026-11-16")).toBe("2026-11-16");
    expect(weekStart("2026-11-22")).toBe("2026-11-16");
    expect(weekStart("2026-11-23")).toBe("2026-11-23");
    expect(weekLabel("2026-11-16")).toBe("Week of Nov 16");
    expect(dayLabel("2026-11-16")).toBe("Mon, Nov 16");
  });
  it("labels days left", () => {
    expect(daysLabel(byId("X1"))).toBe("2d overdue");
    expect(daysLabel(byId("X4"))).toBe("done");
    expect(daysLabel(byId("X2"))).toBe("2d");
    expect(daysLabel(byId("X10"))).toBe("undated");
  });
});

describe("nextDeadline and groups", () => {
  it("next deadline is the soonest item that still needs doing, overdue first", () => {
    expect(nextDeadline(rows)?.id).toBe("X1");
    expect(nextDeadline(rows.filter((r) => r.id !== "X1"))?.id).toBe("X2");
    expect(nextDeadline(rows.filter((r) => r.state === "done" || r.state === "exempt" || r.state === "undated"))).toBeNull();
    expect(nextDeadline([])).toBeNull();
  });
  it("groups overdue, weeks within 90 days, later, verify and exempt", () => {
    const g = groupDeadlines(rows);
    expect(g.overdue.map((d) => d.id)).toEqual(["X1"]);
    expect(g.weeks.map((w) => [w.start, w.items.map((d) => d.id)])).toEqual([
      ["2026-10-26", ["X2"]],
      ["2026-11-02", ["X4", "X3"]], // same day: by title,
      ["2026-11-16", ["X5"]],
      ["2026-12-14", ["X6"]],
    ]);
    expect(g.later.map((d) => d.id)).toEqual(["X7", "X8"]);
    expect(g.verify.map((d) => d.id)).toEqual(["X9", "X10"]);
    expect(g.exempt.map((d) => d.id)).toEqual(["X11"]);
    expect(g.doneEarlier).toBe(0);
  });
  it("hides done items that are already past", () => {
    const g = groupDeadlines(parseDeadlines(deadlinesFixture, "2026-11-10"));
    expect(g.doneEarlier).toBe(1);
    expect(g.overdue.map((d) => d.id)).toEqual(["X1", "X2", "X3"]);
  });
});
