// Sheets REST reader plus the app's write paths (appended rows on input tabs only).
// Per-session in-memory cache only: nothing is written to localStorage or IndexedDB.
// `Customer Codes` is read separately, only when names are on, into memory only.
// The raw `Invoices`, `Journal`, `Customers`, `Payers` and `Review` tabs are never read.
// `App Outbox` (invoice emails, with recipients) is read like Customer Codes: names on only, memory only.
// Writes are appended rows to four input tabs: `App Decisions` (bookings), `App Send` (invoice approvals),
// `App Approvals` (payroll run approve or revoke) and `App Filings` (a filing recorded as done). The app
// pays, files and submits nothing; Python reads these rows at the next publish.
import type { Grid } from "./parse.ts";
import { FILINGS_TAB } from "./filings.ts";
import { CODES_TAB } from "./names.ts";
import { OUTBOX_TAB, SEND_TAB } from "./outbox.ts";
import { APPROVALS_TAB } from "./payroll.ts";
import type { Who } from "./who.ts";

// Set at build time (repo variable VITE_SHEET_ID, or .env.local); deliberately not in the source.
export const SHEET_ID: string = (import.meta.env.VITE_SHEET_ID as string | undefined) ?? "";

export const TABS = [
  "App Summary", "App Transactions", "App Monthly", "App Invoices", "App Decisions",
  "P&L", "Balance Sheet", "Accounts",
  "App Clients", "App Deadlines", "App Payroll", "App Kits", "P&L 2025", "P&L 2024", "Balance Sheet 2025", "Balance Sheet 2024", // history years, from Wave's books
] as const;
export type Tab = (typeof TABS)[number];
export type Tabs = Record<Tab, Grid>;

export const DECISIONS_TAB = "App Decisions";

type Init = { method?: string; headers: Record<string, string>; body?: string };
type FetchFn = (url: string, init: Init) => Promise<Pick<Response, "ok" | "status" | "json">>;

export class AuthExpiredError extends Error {}

const VALUE_OPTS = "valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING&majorDimension=ROWS";
const BASE = (sheetId: string) => `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;

export function batchUrl(sheetId: string, tabs: readonly string[]): string {
  const ranges = tabs.map((t) => "ranges=" + encodeURIComponent(t)).join("&");
  return `${BASE(sheetId)}/values:batchGet?${ranges}&${VALUE_OPTS}`;
}

export function tabUrl(sheetId: string, tab: string): string {
  return `${BASE(sheetId)}/values/${encodeURIComponent(tab)}?${VALUE_OPTS}`;
}

export function appendUrl(sheetId: string): string {
  return `${BASE(sheetId)}/values/${encodeURIComponent(DECISIONS_TAB + "!A:E")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
}

export function sendUrl(sheetId: string): string {
  return `${BASE(sheetId)}/values/${encodeURIComponent(SEND_TAB + "!A:E")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
}

// [Kind, Ref, Fingerprint, Amounts (JSON), Action, Who, When]
export function approvalsUrl(sheetId: string): string {
  return `${BASE(sheetId)}/values/${encodeURIComponent(APPROVALS_TAB + "!A:G")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
}

// [Id, Period, Confirmation, Amount, Filed on, Method, Who, When, Note]
export function filingsUrl(sheetId: string): string {
  return `${BASE(sheetId)}/values/${encodeURIComponent(FILINGS_TAB + "!A:I")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
}

// [Entry, Account, Note, Who, When]
export function decisionRow(entry: string, account: string, note: string, who: Who, now: Date = new Date()): string[] {
  return [entry, account, note.trim(), who, now.toISOString()];
}

export function createReader(
  getToken: () => string | null,
  fetchFn: FetchFn = (u, i) => fetch(u, i),
  sheetId: string = SHEET_ID,
) {
  let cache: Tabs | null = null; // session memory only
  const auth = () => {
    const token = getToken();
    if (!token) throw new AuthExpiredError("Not signed in");
    return { Authorization: `Bearer ${token}` };
  };
  return {
    async read(force = false): Promise<Tabs> {
      if (cache && !force) return cache;
      const headers = auth();
      const out = {} as Tabs;
      const res = await fetchFn(batchUrl(sheetId, TABS), { headers });
      if (res.status === 401) throw new AuthExpiredError("Sign-in expired");
      if (res.ok) {
        const body = (await res.json()) as { valueRanges?: { values?: Grid }[] };
        TABS.forEach((t, i) => { out[t] = body.valueRanges?.[i]?.values ?? []; });
      } else if (res.status === 400) {
        // A tab that is not published yet fails the whole batch: read tab by tab, missing = empty.
        for (const t of TABS) {
          const r = await fetchFn(tabUrl(sheetId, t), { headers });
          if (r.status === 401) throw new AuthExpiredError("Sign-in expired");
          out[t] = r.ok ? (((await r.json()) as { values?: Grid }).values ?? []) : [];
        }
      } else {
        throw new Error(`Sheets read failed (${res.status})`);
      }
      cache = out;
      return out;
    },
    // Runtime-only name lookup: one tab, header [Customer, Code]. Missing tab = empty (codes shown).
    async readCustomerCodes(): Promise<Grid> {
      const res = await fetchFn(tabUrl(sheetId, CODES_TAB), { headers: auth() });
      if (res.status === 401) throw new AuthExpiredError("Sign-in expired");
      return res.ok ? (((await res.json()) as { values?: Grid }).values ?? []) : [];
    },
    // Runtime-only: invoice emails awaiting approval. Missing tab = empty.
    async readOutbox(): Promise<Grid> {
      const res = await fetchFn(tabUrl(sheetId, OUTBOX_TAB), { headers: auth() });
      if (res.status === 401) throw new AuthExpiredError("Sign-in expired");
      return res.ok ? (((await res.json()) as { values?: Grid }).values ?? []) : [];
    },
    // Writes: one appended row on App Decisions (a booking), App Send (an invoice approval), App Approvals
    // (a payroll run approve/revoke) or App Filings (a filing recorded as done).
    async appendDecision(row: string[]): Promise<void> { return append(appendUrl(sheetId), row); },
    async appendSend(row: string[]): Promise<void> { return append(sendUrl(sheetId), row); },
    async appendApproval(row: string[]): Promise<void> { return append(approvalsUrl(sheetId), row); },
    async appendFiling(row: string[]): Promise<void> { return append(filingsUrl(sheetId), row); },
    clear(): void { cache = null; },
  };
  async function append(url: string, row: string[]): Promise<void> {
    const res = await fetchFn(url, {
      method: "POST",
      headers: { ...auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ values: [row] }),
    });
    if (res.status === 401) throw new AuthExpiredError("Sign-in expired");
    if (!res.ok) throw new Error(`Could not save (${res.status})`);
  }
}
