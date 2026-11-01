// Invoice emails waiting for approval. `App Outbox` is written by the Apps Script in Julie's account and
// holds recipients and the email text, so it is read like Customer Codes: only when names are on, only into
// memory, never stored. Approving appends one row to `App Send`; the script re-checks the draft against the
// fingerprint below and sends. The app itself never sends.
import type { Grid } from "./parse.ts";
import type { Who } from "./who.ts";

export const OUTBOX_TAB = "App Outbox";
export const SEND_TAB = "App Send";

// SEND / CANCEL: an Outbox preview, by invoice number. DRAFT_VISIT: draft one App Upcoming row (its Key and
// Fingerprint). MARK_SENT / MARK_ISSUED / VOID: a DRAFT invoice with no Gmail draft, by number. CLOSE_OUT: a DRAFT
// invoice that has a Gmail draft Julie will not send (patient pays in person): the script discards the draft and
// sets the invoice ISSUED, to be closed by the bank deposit match; same row shape as the marks. DRAFT (draft
// everything due) is the old generic request: still understood by the script, no longer offered by any screen.
export type SendAction = "SEND" | "CANCEL" | "DRAFT" | "DRAFT_VISIT" | "MARK_SENT" | "MARK_ISSUED" | "VOID" | "CLOSE_OUT";
export type MarkAction = "MARK_SENT" | "MARK_ISSUED" | "VOID";

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

/**
 * [Number, Fingerprint, Action, Who, When] - the whole request, append-only. For DRAFT_VISIT the first two cells are
 * the App Upcoming Key and Fingerprint; only SEND and DRAFT_VISIT carry a fingerprint; DRAFT carries neither.
 */
export function sendRow(action: SendAction, number: string, fingerprint: string, who: Who, now: Date = new Date()): string[] {
  const fp = action === "SEND" || action === "DRAFT_VISIT" ? fingerprint : "";
  return [action === "DRAFT" ? "" : number, fp, action, who, now.toISOString()];
}

/** What a Ready to send card asked for this session (SEND / CANCEL / CLOSE_OUT), by invoice number. */
export type OutboxRequest = "SEND" | "CANCEL" | "CLOSE_OUT";

/** Card state for one preview: closed out or approved means Approve and send is off; a cancelled send can be redone. */
export function cardState(requested: OutboxRequest | undefined): { approveDisabled: boolean; closedOut: boolean; sendRequested: boolean } {
  return { approveDisabled: requested === "CLOSE_OUT" || requested === "SEND", closedOut: requested === "CLOSE_OUT", sendRequested: requested === "SEND" };
}

/** Only a READY item with a recipient, a PDF and a fingerprint can be approved. */
export function canApprove(i: OutboxItem): boolean {
  return i.status === "READY" && /@/.test(i.to) && !!i.attachment && !!i.fingerprint;
}
