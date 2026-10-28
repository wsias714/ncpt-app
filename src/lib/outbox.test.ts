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
