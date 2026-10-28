import { describe, expect, it, vi } from "vitest";
import { AuthExpiredError, TABS, appendUrl, batchUrl, createReader, decisionRow, sendUrl } from "./sheets.ts";

const ok = (values: unknown[][][]) => ({
  ok: true, status: 200,
  json: async () => ({ valueRanges: values.map((v) => ({ values: v })) }),
});
const empties = () => ok(TABS.map(() => []));

describe("createReader", () => {
  it("fetches once per session and serves the cache", async () => {
    const f = vi.fn(async () => ok(TABS.map((t) => [[t]])));
    const r = createReader(() => "tok", f, "SHEET");
    const first = await r.read();
    await r.read();
    expect(f).toHaveBeenCalledTimes(1);
    expect(first["App Monthly"]).toEqual([["App Monthly"]]);
    await r.read(true);
    expect(f).toHaveBeenCalledTimes(2);
    r.clear();
    await r.read();
    expect(f).toHaveBeenCalledTimes(3);
  });
  it("sends the bearer token, reads the app tabs and never the raw ones", async () => {
    const f = vi.fn(async () => empties());
    await createReader(() => "tok", f, "SHEET").read();
    const [url, init] = f.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(url).toBe(batchUrl("SHEET", TABS));
    for (const raw of ["Journal", "Customers", "Payers", "Review"]) expect(url).not.toContain(encodeURIComponent(raw));
    expect(decodeURIComponent(url)).not.toMatch(/ranges=Invoices(&|$)/);
  });
  it("falls back to tab-by-tab when an unpublished tab fails the batch", async () => {
    const f = vi.fn(async (url: string) => {
      if (url.includes("values:batchGet")) return { ok: false, status: 400, json: async () => ({}) };
      if (url.includes("App%20Monthly")) return { ok: false, status: 400, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ values: [["x"]] }) };
    });
    const tabs = await createReader(() => "t", f, "S").read();
    expect(tabs["App Monthly"]).toEqual([]);
    expect(tabs["App Summary"]).toEqual([["x"]]);
  });
  it("signals expired or missing auth", async () => {
    await expect(createReader(() => null, vi.fn(), "S").read()).rejects.toBeInstanceOf(AuthExpiredError);
    const f = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }));
    await expect(createReader(() => "t", f, "S").read()).rejects.toBeInstanceOf(AuthExpiredError);
  });
});

describe("appendDecision", () => {
  it("posts one row to App Decisions only", async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    const row = decisionRow("bank:t1", "7000", " note ", "Julie", new Date("2030-03-15T10:00:00Z"));
    expect(row).toEqual(["bank:t1", "7000", "note", "Julie", "2030-03-15T10:00:00.000Z"]);
    await createReader(() => "tok", f, "SHEET").appendDecision(row);
    const [url, init] = f.mock.calls[0] as unknown as [string, { method: string; body: string }];
    expect(url).toBe(appendUrl("SHEET"));
    expect(decodeURIComponent(url)).toContain("App Decisions!A:E:append");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ values: [row] });
  });
  it("throws on failure", async () => {
    const f = vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) }));
    await expect(createReader(() => "t", f, "S").appendDecision(["a"])).rejects.toThrow("403");
  });
});

describe("invoice approvals", () => {
  it("never reads the outbox in the batch, only on request", async () => {
    expect(TABS as readonly string[]).not.toContain("App Outbox");
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ values: [["Number"]] }) }));
    expect(await createReader(() => "tok", f, "SHEET").readOutbox()).toEqual([["Number"]]);
    expect(decodeURIComponent((f.mock.calls[0] as unknown as [string])[0])).toContain("/values/App Outbox?");
  });
  it("appends one row to App Send only", async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    await createReader(() => "tok", f, "SHEET").appendSend(["9101", "fp", "SEND", "Julie", "2030-03-15T10:00:00.000Z"]);
    const [url, init] = f.mock.calls[0] as unknown as [string, { method: string; body: string }];
    expect(url).toBe(sendUrl("SHEET"));
    expect(decodeURIComponent(url)).toContain("App Send!A:E:append");
    expect(JSON.parse(init.body)).toEqual({ values: [["9101", "fp", "SEND", "Julie", "2030-03-15T10:00:00.000Z"]] });
  });
  it("surfaces a failed or expired save", async () => {
    const bad = vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) }));
    await expect(createReader(() => "t", bad, "S").appendSend(["x"])).rejects.toThrow("Could not save (403)");
    const exp = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }));
    await expect(createReader(() => "t", exp, "S").appendSend(["x"])).rejects.toBeInstanceOf(AuthExpiredError);
  });
});
