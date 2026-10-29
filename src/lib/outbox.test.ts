import { describe, expect, it } from "vitest";
import { canApprove, parseOutbox, sendRow } from "./outbox.ts";
import { outboxFixture } from "./fixtures.ts";

describe("parseOutbox", () => {
  it("reads READY and SENT rows by header and skips anything else", () => {
    const items = parseOutbox(outboxFixture);
    expect(items.map((i) => [i.number, i.status])).toEqual([["9101", "READY"], ["9102", "READY"], ["9100", "SENT"]]);
    expect(items[0]).toMatchObject({ code: "Customer A", total: 200, to: "billing@example.com", attachment: "NCPT Invoice 9101.pdf" });
    expect(items[0].body).toBe("Hello,\nInvoice attached.");
  });
  it("is empty for a missing or header-only tab", () => {
    expect(parseOutbox([])).toEqual([]);
    expect(parseOutbox([["Number", "Status"]])).toEqual([]);
  });
});

describe("sendRow", () => {
  const now = new Date("2030-03-15T10:00:00Z");
  it("carries the previewed fingerprint only on a SEND", () => {
    expect(sendRow("SEND", "9101", "fp1", "Julie", now)).toEqual(["9101", "fp1", "SEND", "Julie", "2030-03-15T10:00:00.000Z"]);
    expect(sendRow("CANCEL", "9101", "fp1", "Julie", now)).toEqual(["9101", "", "CANCEL", "Julie", "2030-03-15T10:00:00.000Z"]);
    expect(sendRow("DRAFT", "9101", "fp1", "Wade", now)).toEqual(["", "", "DRAFT", "Wade", "2030-03-15T10:00:00.000Z"]);
  });
});

describe("canApprove", () => {
  const [ready, noMail, sent] = parseOutbox(outboxFixture);
  it("needs a READY invoice with recipient, PDF and fingerprint", () => {
    expect(canApprove(ready)).toBe(true);
    expect(canApprove({ ...ready, to: "" })).toBe(false);
    expect(canApprove({ ...ready, attachment: "" })).toBe(false);
    expect(canApprove({ ...ready, fingerprint: "" })).toBe(false);
    expect(canApprove(noMail)).toBe(false);
    expect(canApprove(sent)).toBe(false);
  });
});

// outbox.golden.json is written by the Apps Script simulation (CFO ncpt_books/apps-script/test_sim.js, synthetic
// example.com customers): the real Send.gs output after Sheets-style parsing (coerce mode), rendered the way
// sheets.ts reads it (UNFORMATTED_VALUE, FORMATTED_STRING). Regenerate it there if the outbox columns change:
//   SIM_OUTBOX_JSON=$PWD/../ncpt-app/src/lib/outbox.golden.json node --test test_sim.js   (in CFO ncpt_books/apps-script)
import golden from "./outbox.golden.json";

describe("contract with Send.gs", () => {
  const grid = golden as unknown[][];
  const items = parseOutbox(grid);

  it("parses the grid the script actually writes and allows approving it", () => {
    expect(items.length).toBe(grid.length - 1);
    expect(items.length).toBeGreaterThanOrEqual(2);
    for (const i of items) {
      expect(i.status).toBe("READY");
      expect(i.fingerprint).toMatch(/^[0-9a-f]{24}$/);
      expect(canApprove(i)).toBe(true);
    }
  });

  it("keeps invoice numbers as text, totals numeric, and dates displayable", () => {
    for (const i of items) {
      expect(i.number).toMatch(/^\d{4,}$/);
      expect(typeof i.total).toBe("number");
      expect(i.total).toBeGreaterThan(0);
      expect(i.date).toMatch(/^(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})$/);
      expect(i.due).toMatch(/^(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})$/);
      expect(i.code).toMatch(/^Customer [A-Z]$/);
      expect(i.to).toMatch(/@/);
      expect(i.attachment).toMatch(/\.pdf$/);
      expect(i.prepared).not.toBe("");
    }
  });

  it("still reads the row if Sheets hands back a number and an M/D/YYYY date instead of text", () => {
    const head = grid[0];
    const row = [...grid[1]];
    row[head.indexOf("Number")] = 3542;
    row[head.indexOf("Invoice date")] = "11/17/2026";
    row[head.indexOf("Total")] = "$200.00";
    const [i] = parseOutbox([head, row]);
    expect(i).toMatchObject({ number: "3542", date: "11/17/2026", total: 200 });
    expect(canApprove(i)).toBe(true);
  });
});
