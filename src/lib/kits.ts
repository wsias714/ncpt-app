// Pure parser for the `App Kits` tab published by CFO/ncpt_books (kits.py). Long format
// [Kit, Period, Order, Line, Label, Value, Source, Tie, Status]: per (Kit, Period) one header row (Line "kit": Label is the
// title, Value the portal, Source the fingerprint, Status ready|verify|check|blocked), the fields in Order, tie-outs
// (Line "tie", Status ok|FAIL|n/a), then verify and blocked notes. Kit "TIES" holds the year-end tie-outs.
// Codes and amounts only. The app shows the values to copy; it files nothing.
import type { Deadline } from "./deadlines.ts";
import { text, toNumber, type Grid } from "./parse.ts";

export const KITS_TAB = "App Kits";

export type KitStatus = "ready" | "verify" | "check" | "blocked";
export type TieStatus = "ok" | "FAIL" | "n/a";

export interface KitField { order: number; line: string; label: string; display: string; copy: string; source: string; status: string }
export interface KitTie { name: string; label: string; value: string; note: string; status: TieStatus }
export interface Kit {
  id: string; period: string; title: string; portal: string; fingerprint: string; status: KitStatus;
  fields: KitField[]; ties: KitTie[]; verify: string[]; blocked: string[];
}

// Counts are printed as whole numbers, every other number as money with two decimals.
const COUNT_LABEL = /^(employees|number of employees)\b/i;

function fieldText(label: string, v: unknown): { display: string; copy: string } {
  const n = typeof v === "number" ? v : null;
  if (n === null || !Number.isFinite(n)) { const s = text(v); return { display: s, copy: s }; }
  if (COUNT_LABEL.test(label)) return { display: String(n), copy: String(n) };
  return { display: n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), copy: n.toFixed(2) };
}

const STATUSES: readonly KitStatus[] = ["ready", "verify", "check", "blocked"];
const TIE: Record<string, TieStatus> = { ok: "ok", fail: "FAIL", "n/a": "n/a" };

export function parseKits(grid: Grid): Kit[] {
  const byKey = new Map<string, Kit>();
  const order: Kit[] = [];
  for (const r of grid.slice(1)) {
    if (!Array.isArray(r) || text(r[0]) === "") continue;
    const id = text(r[0]), period = text(r[1]), key = id + "|" + period;
    let kit = byKey.get(key);
    if (!kit) {
      kit = { id, period, title: id, portal: "", fingerprint: "", status: "ready", fields: [], ties: [], verify: [], blocked: [] };
      byKey.set(key, kit); order.push(kit);
    }
    const line = text(r[3]), label = text(r[4]), status = text(r[8]);
    if (line === "kit") {
      kit.title = label || id; kit.portal = text(r[5]); kit.fingerprint = text(r[6]);
      kit.status = STATUSES.includes(status as KitStatus) ? (status as KitStatus) : "ready";
    } else if (line === "tie") {
      kit.ties.push({ name: text(r[7]), label, value: text(r[5]), note: text(r[6]), status: TIE[status.toLowerCase()] ?? "n/a" });
    } else if (line === "verify") kit.verify.push(label);
    else if (line === "blocked") kit.blocked.push(label);
    else {
      kit.fields.push({ order: toNumber(r[2]) ?? 0, line, label, ...fieldText(label, r[5]), source: text(r[6]), status });
    }
  }
  for (const k of order) k.fields.sort((a, b) => a.order - b.order);
  return order;
}

// DE 9 and DE 9C are one kit (C1) but two deadline items (C1, C2).
const KIT_OF: Record<string, string> = { C2: "C1" };
export const kitIdFor = (deadlineId: string): string => KIT_OF[deadlineId] ?? deadlineId;

export function kitForDeadline(kits: Kit[], id: string, period: string): Kit | undefined {
  const kid = kitIdFor(id);
  return kits.find((k) => k.id === kid && k.period === period);
}

/** The deadline rows (Id + Period) a kit can be recorded as filed against. */
export function deadlinesForKit(kit: Kit, deadlines: Deadline[]): Deadline[] {
  return deadlines.filter((d) => d.period === kit.period && kitIdFor(d.id) === kit.id);
}

export const failingTies = (kit: Kit): KitTie[] => kit.ties.filter((t) => t.status === "FAIL");
export const yearEndTies = (kits: Kit[]): Kit[] => kits.filter((k) => k.id === "TIES");
