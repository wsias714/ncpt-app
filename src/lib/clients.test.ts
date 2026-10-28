import { describe, expect, it } from "vitest";
import { byClient, byMonth, byYear, clientYears, inRange, parseClients, summarize } from "./clients.ts";
import { clientsFixture } from "./fixtures.ts";

const rows = parseClients(clientsFixture);

describe("clients", () => {
  it("parses rows and tolerates an empty tab", () => {
    expect(rows).toHaveLength(9);
    expect(rows[4]).toEqual({ month: "2030-01", code: "Customer V", invoiced: 2600, collected: 0, visits: 13, invoices: 1 });
    expect(parseClients([])).toEqual([]);
    expect(clientYears(rows)).toEqual(["2030", "2029"]);
  });
  it("ranges: all, last 12 months, one year", () => {
    expect(inRange(rows, "ALL", "2030-03-15")).toHaveLength(9);
    expect(inRange(rows, "2029", "2030-03-15")).toHaveLength(3);
    expect(inRange(rows, "12M", "2030-03-15").map((r) => r.month)).not.toContain("2029-02");
    expect(inRange(rows, "12M", "2030-03-15")).toHaveLength(6);
    expect(inRange(rows, "2030", "2030-02-10").map((r) => r.month)).not.toContain("2030-03");
  });
  it("summarizes revenue, visits, clients and per visit", () => {
    const t = summarize(inRange(rows, "2030", "2030-03-15"));
    expect(t).toMatchObject({ revenue: 7800, visits: 38, clients: 4, collected: 6400 });
    expect(t.perVisit).toBeCloseTo(205.26, 2);
    expect(summarize([]).perVisit).toBeNull();
  });
  it("counts new clients in the year of their first invoice", () => {
    const y = byYear(rows);
    expect(y.map((r) => [r.year, r.clients, r.newClients])).toEqual([["2030", 4, 2], ["2029", 2, 2]]);
  });
  it("lists clients by revenue with share and first/last month", () => {
    const l = byClient(inRange(rows, "2030", "2030-03-15"), rows);
    expect(l[0]).toMatchObject({ code: "Customer V", revenue: 6500, first: "2030-01", last: "2030-03" });
    expect(l[0].share).toBeCloseTo(6500 / 7800, 5);
    expect(l.find((c) => c.code === "Customer A")).toMatchObject({ first: "2029-02", last: "2030-01" });
  });
  it("monthly points", () => {
    expect(byMonth(rows).map((p) => p.month)).toEqual(["2029-02", "2029-03", "2030-01", "2030-02", "2030-03"]);
    expect(byMonth(rows)[4]).toMatchObject({ revenue: 1600, visits: 7.5, clients: 2 });
  });
});
