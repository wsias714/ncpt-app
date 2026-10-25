import { describe, expect, it, vi } from "vitest";
import { AuthExpiredError, batchUrl, createReader } from "./sheets.ts";

const ok = (values: unknown[][][]) => ({
  ok: true, status: 200,
  json: async () => ({ valueRanges: values.map((v) => ({ values: v })) }),
});

describe("createReader", () => {
  it("fetches once per session and serves the cache", async () => {
    const f = vi.fn(async () => ok([[["a"]], [["b"]], [["c"]]]));
    const r = createReader(() => "tok", f, "SHEET");
    const first = await r.read();
    await r.read();
    expect(f).toHaveBeenCalledTimes(1);
    expect(first.Close).toEqual([["b"]]);
    await r.read(true);
    expect(f).toHaveBeenCalledTimes(2);
    r.clear();
    await r.read();
    expect(f).toHaveBeenCalledTimes(3);
  });
  it("sends the bearer token and requests the three tabs", async () => {
    const f = vi.fn(async () => ok([[], [], []]));
    await createReader(() => "tok", f, "SHEET").read();
    const [url, init] = f.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(url).toBe(batchUrl("SHEET", ["Dashboard", "Close", "Invoices"]));
  });
  it("signals expired or missing auth", async () => {
    await expect(createReader(() => null, vi.fn(), "S").read()).rejects.toBeInstanceOf(AuthExpiredError);
    const f = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }));
    await expect(createReader(() => "t", f, "S").read()).rejects.toBeInstanceOf(AuthExpiredError);
  });
});
