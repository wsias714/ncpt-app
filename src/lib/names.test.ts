import { describe, expect, it, vi } from "vitest";
import { txFixture } from "./fixtures.ts";
import {
  displayName, loadNameMap, makeLabeler, namesEnabled, namesForcedOff, parseCustomerCodes, saveNamesPref, savedNamesPref,
} from "./names.ts";
import { filterTransactions, NO_FILTER, parseTransactions } from "./parse.ts";
import { TABS, createReader } from "./sheets.ts";
import { getWho, setWho } from "./who.ts";

// Made-up names only.
const codesFixture = [
  ["Customer", "Code"],
  ["Doe, Pat", "Customer A"],
  ["Roe, Sam & Alex", "Customer B"],
  ["Acme Test Org", "Customer C"],
  ["", "Customer D"],
  ["Poe, Lee", "not a code"],
];

class MemStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

describe("names", () => {
  it("formats display names", () => {
    expect(displayName("Doe, Pat")).toBe("Pat Doe");
    expect(displayName("Roe, Sam & Alex")).toBe("Sam & Alex Roe");
    expect(displayName("Acme Test Org")).toBe("Acme Test Org");
  });
  it("parses the tab, skipping header, blanks and malformed rows", () => {
    const m = parseCustomerCodes(codesFixture);
    expect([...m.keys()]).toEqual(["Customer A", "Customer B", "Customer C"]);
    expect(m.get("Customer A")).toBe("Pat Doe");
  });
  it("substitutes codes, leaving unmapped codes and partial matches alone", () => {
    const label = makeLabeler(parseCustomerCodes(codesFixture));
    expect(label("Deposit from Customer A")).toBe("Deposit from Pat Doe");
    expect(label("Customer B and Customer Z")).toBe("Sam & Alex Roe and Customer Z");
    expect(label("Customer AB")).toBe("Customer AB");
    expect(makeLabeler(new Map())("Customer A")).toBe("Customer A");
  });
  it("search matches names as well as codes", () => {
    const txs = parseTransactions(txFixture);
    const label = makeLabeler(parseCustomerCodes(codesFixture));
    const q = (query: string, l?: typeof label) => filterTransactions(txs, { ...NO_FILTER, query }, new Map(), l).length;
    expect(q("pat doe", label)).toBe(1);
    expect(q("customer a", label)).toBe(1);
    expect(q("pat doe")).toBe(0);
  });
});

describe("names off", () => {
  it("?names=off forces off regardless of saved preference", () => {
    expect(namesForcedOff("?names=off")).toBe(true);
    expect(namesEnabled("?names=off", true)).toBe(false);
    expect(namesEnabled("", true)).toBe(true);
    expect(namesEnabled("?names=on", false)).toBe(false);
  });
  it("?names=off skips the Customer Codes fetch", async () => {
    const f = vi.fn(async () => [["Doe, Pat", "Customer A"]]);
    const off = await loadNameMap(namesEnabled("?names=off", true), f);
    expect(off.size).toBe(0);
    expect(f).not.toHaveBeenCalled();
    await loadNameMap(namesEnabled("", true), f);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("reader fetches only the Customer Codes tab, and the main read never includes it", async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ values: codesFixture, valueRanges: TABS.map(() => ({})) }) }));
    const r = createReader(() => "tok", f, "SHEET");
    expect(await r.readCustomerCodes()).toEqual(codesFixture);
    const [url] = f.mock.calls[0] as unknown as [string];
    expect(decodeURIComponent(url)).toContain("/values/Customer Codes?");
    await r.read();
    const batch = decodeURIComponent((f.mock.calls[1] as unknown as [string])[0]);
    expect(batch).not.toContain("Customer Codes");
  });
});

describe("storage", () => {
  it("writes only the names preference and the who label, never names", async () => {
    const st = new MemStorage();
    vi.stubGlobal("localStorage", st);
    try {
      saveNamesPref(false);
      expect(savedNamesPref()).toBe(false);
      saveNamesPref(true);
      setWho("Julie");
      expect(getWho()).toBe("Julie");
      const map = await loadNameMap(true, async () => codesFixture);
      makeLabeler(map)("Customer A");
      expect([...st.data.keys()].sort()).toEqual(["ncpt.names", "ncpt.who"]);
      const all = JSON.stringify([...st.data.values()]);
      for (const n of ["Doe", "Roe", "Acme"]) expect(all).not.toContain(n);
    } finally { vi.unstubAllGlobals(); }
  });
});
