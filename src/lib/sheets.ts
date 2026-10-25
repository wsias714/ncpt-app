// Read-only Sheets REST reader. Per-session in-memory cache only: nothing is written to
// localStorage or IndexedDB. A page reload starts empty.
import type { Grid } from "./parse.ts";

export const SHEET_ID: string =
  (import.meta.env.VITE_SHEET_ID as string | undefined) || "1N-9EZAVjsnQ5Xr9BePLTVzrQwrLZMvSH3DzihLlFsIY";

export const TABS = ["Dashboard", "Close", "Invoices"] as const;
export type Tab = (typeof TABS)[number];
export type Tabs = Record<Tab, Grid>;

type FetchFn = (url: string, init: { headers: Record<string, string> }) => Promise<Pick<Response, "ok" | "status" | "json">>;

export class AuthExpiredError extends Error {}

export function batchUrl(sheetId: string, tabs: readonly string[]): string {
  const ranges = tabs.map((t) => "ranges=" + encodeURIComponent(t)).join("&");
  return (
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${ranges}` +
    "&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING&majorDimension=ROWS"
  );
}

export function createReader(
  getToken: () => string | null,
  fetchFn: FetchFn = (u, i) => fetch(u, i),
  sheetId: string = SHEET_ID,
) {
  let cache: Tabs | null = null; // session memory only
  return {
    async read(force = false): Promise<Tabs> {
      if (cache && !force) return cache;
      const token = getToken();
      if (!token) throw new AuthExpiredError("Not signed in");
      const res = await fetchFn(batchUrl(sheetId, TABS), { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) throw new AuthExpiredError("Sign-in expired");
      if (!res.ok) throw new Error(`Sheets read failed (${res.status})`);
      const body = (await res.json()) as { valueRanges?: { values?: Grid }[] };
      const out = {} as Tabs;
      TABS.forEach((t, i) => { out[t] = body.valueRanges?.[i]?.values ?? []; });
      cache = out;
      return out;
    },
    clear(): void { cache = null; },
  };
}
