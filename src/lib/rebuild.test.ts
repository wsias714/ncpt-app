import { describe, expect, it, vi } from "vitest";
import { decisionsWithStatusFixture, invoices10Fixture, invoicesFixture, txFixture, txIgnoredRows } from "./fixtures.ts";
import { sendRow } from "./outbox.ts";
import {
  decisionProblem, invoiceStats, isIgnored, isPending, latestDecisions, parseAppInvoices, parseDecisions, parseTransactions, rejection, txCategories, txChip,
} from "./parse.ts";
import { TABS, createReader, decisionRow, tabUrl } from "./sheets.ts";

const TODAY = "2030-03-15";
const names = new Map([["7000", "Software"], ["6200", "Supplies"]]);

describe("App Invoices, 10 columns", () => {
  const items = parseAppInvoices(invoices10Fixture, TODAY);
  const st = invoiceStats(items, TODAY);
  it("reads Paid on, Deposit and Email draft; dates may be M/D/YYYY and numbers may be numeric", () => {
    expect(items.map((i) => i.number)).toEqual(["9010", "9011", "9012", "9013", "9014", "9015", "9016", "9017"]);
    expect(items[1]).toMatchObject({ invoiceDate: "2030-03-03", due: "2030-03-03", emailDraft: false });
    expect(items[0].emailDraft).toBe(true);
    expect(items[4]).toMatchObject({ paidOn: "2030-03-04", deposit: "3/4 $899.50 + 3/4 $0.50", status: "PAID" });
  });
  it("splits drafts into Ready to send (email draft) and Needs attention (no email)", () => {
    expect(st.readyToSend.map((i) => i.number)).toEqual(["9010"]);
    expect(st.needsAttention.map((i) => i.number)).toEqual(["9011"]);
    expect(st.drafts).toHaveLength(2);
  });
  it("awaiting payment is SENT and ISSUED, oldest first; VOID and WRITTEN_OFF are in neither list", () => {
    expect(st.outstanding.map((i) => i.number)).toEqual(["9013", "9012"]);
    expect(st.outstandingTotal).toBe(1550);
    expect(st.outstanding.some((i) => i.status === "VOID" || i.status === "WRITTEN_OFF")).toBe(false);
  });
  it("recently paid uses the paid date, newest first, last 30 days only", () => {
    expect(st.paid30.map((i) => i.number)).toEqual(["9014"]); // 9015 was paid 2030-01-02: too old although the code path would take it by invoice date
    expect(st.paid30Total).toBe(900);
  });
  it("still parses the old 7-column grid: no paid date, email draft unknown, drafts count as ready to send", () => {
    const old = parseAppInvoices(invoicesFixture, TODAY);
    expect(old.every((i) => i.emailDraft === null && i.paidOn === "" && i.deposit === "")).toBe(true);
    const s = invoiceStats(old, TODAY);
    expect(s.needsAttention).toEqual([]);
    expect(s.readyToSend).toEqual(s.drafts);
  });
});

describe("App Send rows", () => {
  const now = new Date("2030-03-15T10:00:00Z");
  it("DRAFT_VISIT carries the App Upcoming key and fingerprint", () => {
    expect(sendRow("DRAFT_VISIT", "V-2030-03-12-ab12", "fp9", "Julie", now)).toEqual(["V-2030-03-12-ab12", "fp9", "DRAFT_VISIT", "Julie", "2030-03-15T10:00:00.000Z"]);
  });
  it("MARK_SENT, MARK_ISSUED and VOID carry the invoice number and no fingerprint", () => {
    for (const a of ["MARK_SENT", "MARK_ISSUED", "VOID"] as const) {
      expect(sendRow(a, "9011", "ignored-fp", "Wade", now)).toEqual(["9011", "", a, "Wade", "2030-03-15T10:00:00.000Z"]);
    }
  });
  it("CLOSE_OUT has the same shape as the marks: number, no fingerprint, in order", () => {
    expect(sendRow("CLOSE_OUT", "9011", "ignored-fp", "Julie", now)).toEqual(["9011", "", "CLOSE_OUT", "Julie", "2030-03-15T10:00:00.000Z"]);
  });
  it("the old generic DRAFT still builds its blank row", () => {
    expect(sendRow("DRAFT", "9011", "fp", "Wade", now)).toEqual(["", "", "DRAFT", "Wade", "2030-03-15T10:00:00.000Z"]);
  });
});

describe("reading App Upcoming", () => {
  it("is not in the main batch, so a missing tab cannot break it", () => {
    expect(TABS as readonly string[]).not.toContain("App Upcoming");
  });
  it("reads its own tab, names on or off", async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ values: [["Key"], ["k"]] }) }));
    expect(await createReader(() => "tok", f, "SHEET").readUpcoming()).toEqual([["Key"], ["k"]]);
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe(tabUrl("SHEET", "App Upcoming"));
  });
  it("a missing tab (404/400) is an empty grid, not an error", async () => {
    for (const status of [400, 404]) {
      const f = vi.fn(async () => ({ ok: false, status, json: async () => ({}) }));
      expect(await createReader(() => "tok", f, "SHEET").readUpcoming()).toEqual([]);
    }
  });
});

describe("Applied to and ignored transactions", () => {
  const txs = parseTransactions([...txFixture, ...txIgnoredRows]);
  const byEntry = (e: string) => txs.find((t) => t.entry === e)!;
  it("reads r[10] as appliedTo", () => {
    expect(byEntry("bank:t4").appliedTo).toBe("Invoice 9001 (Customer A)");
    expect(byEntry("bank:t8").appliedTo).toBe("Invoices 9102, 9103 (Customer B) (proposed)");
    expect(byEntry("bank:t6").appliedTo).toBe("");
  });
  it("an older 10-column grid still parses", () => {
    expect(parseTransactions([txFixture[0].slice(0, 10), txFixture[1].slice(0, 10)])[0].appliedTo).toBe("");
  });
  it("ignored rows show Ignored: <reason> and are not 'needs booking'", () => {
    const t = byEntry("bank:t7");
    expect(isIgnored(t)).toBe(true);
    expect(txChip(t, new Map(), names)).toEqual({ text: "Ignored: moved between own accounts", kind: "ignored" });
    expect(txChip(byEntry("bank:t6"), new Map(), names)).toEqual({ text: "Needs booking", kind: "review" });
    expect(txCategories(txs).find((c) => c.code === "IGNORE")?.name).toBe("Ignored");
  });
});

describe("decisions with Status (App Decisions column F)", () => {
  const txs = parseTransactions([...txFixture, ...txIgnoredRows]);
  const tx = (e: string) => txs.find((t) => t.entry === e)!;
  const ds = parseDecisions(decisionsWithStatusFixture);
  const latest = latestDecisions(ds);

  it("reads column F and an older 5-column row without it", () => {
    expect(ds.map((d) => d.status)).toEqual(["ignored", "rejected: locked period", ""]);
    expect(parseDecisions([["Entry", "Account", "Note", "Who", "When"], ["bank:t1", "7000", "", "Wade", "x"]])[0].status).toBe("");
  });
  it("a lower-case ignore matches the published IGNORE code, so it is not pending", () => {
    expect(isPending(tx("bank:t7"), latest)).toBe(false);
  });
  it("a rejected decision is not pending and shows why", () => {
    expect(isPending(tx("bank:t2"), latest)).toBe(false);
    expect(rejection(tx("bank:t2"), latest)).toBe("locked period");
    expect(txChip(tx("bank:t2"), latest, names)).toEqual({ text: "not applied: locked period", kind: "rejected" });
    expect(rejection(tx("bank:t3"), latest)).toBe("");
  });
  it("a new decision with a blank status is pending: a re-book shows the category, an ignore shows 'ignore'", () => {
    expect(txChip(tx("bank:t3"), latest, names)).toEqual({ text: "pending: Supplies", kind: "pend" });
    const l = latestDecisions([{ entry: "bank:t6", account: "IGNORE", note: "x", who: "Wade", when: "w", status: "" }]);
    expect(txChip(tx("bank:t6"), l, names)).toEqual({ text: "pending: ignore", kind: "pend" });
  });
  it("a superseded older row never matters, the latest wins", () => {
    const l = latestDecisions([
      { entry: "bank:t5", account: "6200", note: "", who: "W", when: "1", status: "superseded" },
      { entry: "bank:t5", account: "7000", note: "", who: "W", when: "2", status: "applied" },
    ]);
    expect(isPending(tx("bank:t5"), l)).toBe(false);
  });
});

describe("writing an ignore", () => {
  it("IGNORE needs a note; a chart code does not", () => {
    expect(decisionProblem("", "")).toBe("Choose an account");
    expect(decisionProblem("IGNORE", "  ")).toBe("Say why it is ignored");
    expect(decisionProblem("IGNORE", "moved between own accounts")).toBe("");
    expect(decisionProblem("7000", "")).toBe("");
  });
  it("appends [Entry, IGNORE, Note, Who, When] with column F left to Python", () => {
    const row = decisionRow("bank:t7", "ignore", " moved between own accounts ", "Wade", new Date("2030-03-15T10:00:00Z"));
    expect(row).toEqual(["bank:t7", "IGNORE", "moved between own accounts", "Wade", "2030-03-15T10:00:00.000Z"]);
    expect(row).toHaveLength(5);
  });
});
