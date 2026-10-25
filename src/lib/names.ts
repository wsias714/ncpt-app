// Wave-style customer names, shown only in the browser and only in memory.
// The code -> display name map is read at runtime from the user's own Google Sheet tab
// `Customer Codes` (header [Customer, Code]) and is never written to storage, logs or the build.
// Only the on/off preference (a boolean) is persisted.
import type { Grid } from "./parse.ts";

export const CODES_TAB = "Customer Codes";
const PREF_KEY = "ncpt.names";
const CODE_IN_TEXT = /Customer [A-Z0-9]{1,3}\b/g;

export type NameMap = ReadonlyMap<string, string>;
export const NO_NAMES: NameMap = new Map();

/** "Last, First & First" -> "First & First Last". A key with no comma is shown as is. */
export function displayName(key: string): string {
  const k = key.trim();
  const i = k.indexOf(",");
  if (i < 0) return k;
  const last = k.slice(0, i).trim();
  const first = k.slice(i + 1).trim();
  return first && last ? `${first} ${last}` : k;
}

/** Rows are [Customer, Code]; a header row and blank or malformed rows are skipped. */
export function parseCustomerCodes(grid: Grid): NameMap {
  const out = new Map<string, string>();
  for (const r of grid) {
    const key = String(r[0] ?? "").trim();
    const code = String(r[1] ?? "").trim();
    if (!key || !/^Customer [A-Z0-9]{1,3}$/.test(code)) continue;
    out.set(code, displayName(key));
  }
  return out;
}

export type Labeler = (text: string) => string;

/** Replaces every known code in `text` with its display name; unknown codes stay as codes. */
export function makeLabeler(map: NameMap): Labeler {
  if (map.size === 0) return (t) => t;
  return (t) => t.replace(CODE_IN_TEXT, (c) => map.get(c) ?? c);
}

export function savedNamesPref(storage: Pick<Storage, "getItem"> | null = safeStorage()): boolean {
  try { return storage?.getItem(PREF_KEY) !== "off"; } catch { return true; }
}

export function saveNamesPref(on: boolean, storage: Pick<Storage, "setItem"> | null = safeStorage()): void {
  try { storage?.setItem(PREF_KEY, on ? "on" : "off"); } catch { /* preference only */ }
}

/** `?names=off` forces names off for the page load, ignoring the saved preference. */
export function namesForcedOff(search: string): boolean {
  return new URLSearchParams(search).get("names") === "off";
}

export function namesEnabled(search: string, saved: boolean): boolean {
  return !namesForcedOff(search) && saved;
}

/** The Customer Codes tab is fetched only when names are on. */
export async function loadNameMap(enabled: boolean, fetchGrid: () => Promise<Grid>): Promise<NameMap> {
  if (!enabled) return NO_NAMES;
  return parseCustomerCodes(await fetchGrid());
}

function safeStorage(): Storage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}
