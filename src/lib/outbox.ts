// Invoice emails waiting for approval. `App Outbox` is written by the Apps Script in Julie's account and
// holds recipients and the email text, so it is read like Customer Codes: only when names are on, only into
// memory, never stored. Approving appends one row to `App Send`; the script re-checks the draft against the
// fingerprint below and sends. The app itself never sends.
import type { Grid } from "./parse.ts";
import type { Who } from "./who.ts";

export const OUTBOX_TAB = "App Outbox";
export const SEND_TAB = "App Send";

export type SendAction = "SEND" | "CANCEL" | "DRAFT";

export interface OutboxItem {
  number: string; code: string; date: string; due: string; total: number;
  to: string; cc: string; subject: string; body: string; attachment: string; pdf: string; lines: string;
  status: "READY" | "SENT"; fingerprint: string; prepared: string;
}

const text = (v: unknown): string => String(v ?? "").trim();

export function parseOutbox(grid: Grid): OutboxItem[] {
  if (grid.length < 2) return [];
  const head = grid[0].map((h) => text(h));
  const col = (r: unknown[], h: string): unknown => r[head.indexOf(h)];
  const out: OutboxItem[] = [];
  for (const r of grid.slice(1)) {
    const status = text(col(r, "Status"));
    const number = text(col(r, "Number"));
    if (!number || (status !== "READY" && status !== "SENT")) continue;
    const total = Number(String(col(r, "Total") ?? "").replace(/[$,]/g, ""));
    out.push({
      number, code: text(col(r, "Code")), date: text(col(r, "Invoice date")), due: text(col(r, "Due")),
      total: Number.isFinite(total) ? total : 0,
      to: text(col(r, "To")), cc: text(col(r, "Cc")), subject: text(col(r, "Subject")),
      body: String(col(r, "Body") ?? "").replace(/\r\n/g, "\n").trim(), attachment: text(col(r, "Attachment")),
      pdf: text(col(r, "PDF")), lines: text(col(r, "Lines")), status, fingerprint: text(col(r, "Fingerprint")),
      prepared: text(col(r, "Prepared")),
    });
  }
  return out;
}

/** [Number, Fingerprint, Action, Who, When] - the whole approval, append-only. */
export function sendRow(action: SendAction, number: string, fingerprint: string, who: Who, now: Date = new Date()): string[] {
  return [action === "DRAFT" ? "" : number, action === "SEND" ? fingerprint : "", action, who, now.toISOString()];
}

/** Only a READY item with a recipient, a PDF and a fingerprint can be approved. */
export function canApprove(i: OutboxItem): boolean {
  return i.status === "READY" && /@/.test(i.to) && !!i.attachment && !!i.fingerprint;
}
