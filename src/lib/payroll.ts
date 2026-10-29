// Pure parser and approval row for the `App Payroll` tab published by CFO/ncpt_books (payroll_app.py).
// Long format [Section, Key, Label, Amount, Due, Status, Detail], sections run | check | leg | filing | meta.
// Codes and amounts only. The app never pays or files: it shows the figures to copy and appends an approval
// row to `App Approvals`; Python decides whether that row matches the current fingerprint.
import { parseDate } from "./deadlines.ts";
import { text, toNumber, type Grid } from "./parse.ts";
import type { Who } from "./who.ts";

export const PAYROLL_TAB = "App Payroll";
export const APPROVALS_TAB = "App Approvals";

export type ApprovalState = "approved" | "stale" | "none" | "revoked";
export type CheckStatus = "ok" | "warn" | "block";
export type LegStatus = "matched" | "pending" | "mismatch" | "n/a";
export type ApprovalAction = "APPROVE" | "REVOKE";

export interface RunAmount { key: string; label: string; amount: number | null }
export interface Check { id: string; label: string; status: CheckStatus; detail: string }
export interface Leg {
  key: string; label: string; expected: number | null; clearBy: string; status: LegStatus;
  portal: string; clearedOn: string; clearedAmount: number | null; diff: number | null;
}
export interface FilingLine { key: string; label: string; amount: number | null; due: string; detail: string }
export interface PayrollRun {
  ref: string; fingerprint: string; amountsJson: string;
  amounts: RunAmount[]; checks: Check[]; legs: Leg[]; filing: FilingLine[];
  approval: ApprovalState; approvalDetail: string;
  canApprove: boolean; canApproveDetail: string; // Python's own verdict (meta can_approve)
  trackerOk: boolean; trackerWhy: string;
  runBy: string; built: string;
  meta: RunAmount[]; // other meta rows that carry an amount (deferral room, YTD wages...)
}

const CHECK_STATUS: readonly CheckStatus[] = ["ok", "warn", "block"];
const LEG_STATUS: readonly LegStatus[] = ["matched", "pending", "mismatch", "n/a"];
const APPROVAL: readonly ApprovalState[] = ["approved", "stale", "none", "revoked"];

function legDetail(s: string): { portal: string; clearedOn: string; clearedAmount: number | null; diff: number | null } {
  try {
    const d = JSON.parse(s) as Record<string, unknown>;
    return { portal: text(d.portal), clearedOn: text(d.cleared_on), clearedAmount: toNumber(d.cleared_amount), diff: toNumber(d.diff) };
  } catch { return { portal: "", clearedOn: "", clearedAmount: null, diff: null }; }
}

/** null when the tab is missing or has no rows (not published yet). */
export function parsePayroll(grid: Grid): PayrollRun | null {
  const rows = grid.slice(1).filter((r) => Array.isArray(r) && text(r[0]) !== "");
  if (rows.length === 0) return null;
  const run: PayrollRun = {
    ref: "", fingerprint: "", amountsJson: "", amounts: [], checks: [], legs: [], filing: [],
    approval: "none", approvalDetail: "", canApprove: false, canApproveDetail: "",
    trackerOk: true, trackerWhy: "", runBy: "", built: "", meta: [],
  };
  for (const r of rows) {
    const section = text(r[0]).toLowerCase(), key = text(r[1]), label = text(r[2]);
    const amount = toNumber(r[3]), due = parseDate(r[4]), status = text(r[5]).toLowerCase(), detail = text(r[6]);
    if (section === "run") run.amounts.push({ key, label, amount });
    else if (section === "check") {
      run.checks.push({ id: key, label, status: CHECK_STATUS.includes(status as CheckStatus) ? (status as CheckStatus) : "warn", detail });
    } else if (section === "leg") {
      run.legs.push({ key, label, expected: amount, clearBy: due, status: LEG_STATUS.includes(status as LegStatus) ? (status as LegStatus) : "pending", ...legDetail(detail) });
    } else if (section === "filing") run.filing.push({ key, label, amount, due, detail });
    else if (section === "meta") {
      if (key === "ref") run.ref = detail;
      else if (key === "fingerprint") run.fingerprint = detail;
      else if (key === "amounts_json") run.amountsJson = detail;
      else if (key === "approval") { run.approval = APPROVAL.includes(status as ApprovalState) ? (status as ApprovalState) : "none"; run.approvalDetail = detail; }
      else if (key === "can_approve") { run.canApprove = status === "yes"; run.canApproveDetail = detail; }
      else if (key === "tracker") { run.trackerOk = status === "ok"; run.trackerWhy = detail; }
      else if (key === "run_by") run.runBy = due;
      else if (key === "built") run.built = detail;
      else if (amount !== null) run.meta.push({ key, label, amount });
    }
  }
  return run;
}

/** Checks that keep Approve disabled. */
export const blockers = (run: PayrollRun): Check[] => run.checks.filter((c) => c.status === "block");

/** The Approve button works only on a complete run sheet with nothing blocking, tracker reachable, and Python's own can_approve. */
export function canApproveRun(run: PayrollRun): boolean {
  return !!run.ref && !!run.fingerprint && !!run.amountsJson && run.trackerOk && run.canApprove
    && run.amounts.length > 0 && blockers(run).length === 0;
}

/** Why Approve is disabled, "" when it is not. */
export function approveBlockedWhy(run: PayrollRun): string {
  if (!run.trackerOk) return run.trackerWhy || "The payroll tracker is unavailable.";
  const b = blockers(run);
  if (b.length) return "Fix first: " + b.map((c) => c.label).join("; ") + ".";
  if (!run.fingerprint || !run.amountsJson || run.amounts.length === 0) return "The run sheet is incomplete.";
  if (!run.canApprove) return run.canApproveDetail || "The run sheet is not ready to approve.";
  return "";
}

/** [Kind, Ref, Fingerprint, Amounts (JSON), Action, Who, When]. APPROVE freezes the amounts the person saw (they must hash to the
 *  fingerprint or the approval reads as stale); REVOKE carries only the fingerprint. Append-only. */
export function approvalRow(action: ApprovalAction, run: PayrollRun, who: Who, now: Date = new Date()): string[] {
  return ["PAYROLL_RUN", run.ref, run.fingerprint, action === "APPROVE" ? run.amountsJson : "", action, who, now.toISOString()];
}

export const amountOf = (run: PayrollRun, key: string): number | null => run.amounts.find((a) => a.key === key)?.amount ?? null;

/** Exactly what to type into a portal: two decimals, no $ and no thousands commas. */
export const copyAmount = (n: number): string => n.toFixed(2);
