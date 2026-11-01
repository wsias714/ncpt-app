import { useState } from "react";
import { money } from "../lib/parse.ts";
import {
  billingLabel, blockedReason, canCreate, confirmText, isMonthly, missingNote, soFar, timeRange, todoList, unlinkedLine,
  type UpcomingRow, type UpState,
} from "../lib/upcoming.ts";
import { ConfirmSheet } from "./ConfirmSheet.tsx";
import { useLabel } from "./NamesContext.tsx";

const STATE_WORD: Record<UpState, string> = {
  UPCOMING: "upcoming", READY: "ready", WAVE: "Wave", DRAFTED: "drafted", SENT: "sent", ISSUED: "issued", PAID: "paid", UNLINKED: "",
};
const STATE_CLASS: Record<UpState, string> = {
  UPCOMING: "", READY: "ready", WAVE: "", DRAFTED: "month", SENT: "later", ISSUED: "later", PAID: "done", UNLINKED: "",
};

// Billing that never emails: the draft shows up under Needs attention for Mark issued, not under Ready to send.
const handOver = (r: UpcomingRow) => r.billing === "at_visit" || r.billing === "none";

function Item({ r, requested, onCreate }: { r: UpcomingRow; requested: boolean; onCreate: (r: UpcomingRow) => void }) {
  const label = useLabel();
  const wave = r.state === "WAVE";
  const reason = blockedReason(r);
  const when = isMonthly(r) ? soFar(r) : timeRange(r.start, r.end);
  // The script's note repeats the "so far" figures for a month; show only what it adds after the "ready" part.
  const note = isMonthly(r) ? r.note.replace(/^.*?ready [\d/]+;?\s*/i, "") : r.note;
  return (
    <li className={"todo" + (wave ? " muted" : "")}>
      <div className="row">
        <div className="grow">
          <strong>{label(r.code)}</strong>
          <div className="sub">{when}{when ? " - " : ""}{billingLabel(r.billing)}</div>
          {note && !wave && <div className={"sub" + (missingNote(r) ? " amber" : "")}>{note}</div>}
        </div>
        <div className="right">
          <div className="amt">{r.amount === null ? "" : money(r.amount)}</div>
          {STATE_WORD[r.state] && <span className={"dchip " + STATE_CLASS[r.state]}>{STATE_WORD[r.state]}</span>}
        </div>
      </div>
      {wave ? (
        <div className="sub">Bill in Wave (before the app's start date).</div>
      ) : requested ? (
        <p className="ok small">Requested; {handOver(r)
          ? "it appears under Needs attention in about a minute (Mark issued once handed over), tap Refresh."
          : "the preview appears under Ready to send in about a minute, tap Refresh."}</p>
      ) : r.state === "READY" || r.state === "UPCOMING" ? (
        <div className="todoact">
          <button className="btn sm" disabled={!canCreate(r)} onClick={() => onCreate(r)}>Create invoice</button>
          {reason && <span className="sub">{reason}</span>}
        </div>
      ) : (
        reason && <div className="sub">{reason[0].toUpperCase() + reason.slice(1)}</div>
      )}
    </li>
  );
}

interface Props {
  rows: UpcomingRow[] | null; // null: could not load
  today: string; // Pacific
  requested: ReadonlySet<string>; // App Upcoming keys asked for this session
  onCreate: (r: UpcomingRow) => Promise<void>;
}

// To do, next 7 days (App Upcoming). Codes only, so it works with names off.
export function UpcomingList({ rows, today, requested, onCreate }: Props) {
  const label = useLabel();
  const [confirm, setConfirm] = useState<UpcomingRow | null>(null);
  const list = todoList(rows ?? [], today);
  const open = list.groups.reduce((a, g) => a + g.rows.filter((r) => canCreate(r) && !requested.has(r.key)).length, 0);
  return (
    <>
      <h3>To do, next 7 days {open > 0 && <span className="muted">{open} ready to bill</span>}</h3>
      {rows === null && <p className="warn">The to-do list could not load. Tap Refresh to try again.</p>}
      {rows !== null && list.groups.length === 0 && (
        <p className="muted">Nothing expected in the next 7 days{rows.length === 0 ? " (the invoice script has not published the list yet)" : ""}.</p>
      )}
      {list.groups.map((g) => (
        <div key={g.key} className="dayg">
          <h4>{g.label}</h4>
          <ul className="list">
            {g.rows.map((r) => <Item key={r.key} r={r} requested={requested.has(r.key)} onCreate={setConfirm} />)}
          </ul>
        </div>
      ))}
      {list.unlinked > 0 && <p className="sub">{unlinkedLine(list.unlinked)}. Add the calendar title to the customer, or wait for a visit note.</p>}
      {confirm && (
        <ConfirmSheet title={label(confirm.code)} confirmLabel="Create invoice" onConfirm={() => onCreate(confirm)} onClose={() => setConfirm(null)}>
          <p><strong>{confirmText(confirm)}</strong></p>
          <p className="sub">Billing: {billingLabel(confirm.billing)}</p>
          {missingNote(confirm) && (
            <p className="warn">{isMonthly(confirm) ? "Some visits this month have no visit note yet." : "There is no visit note for this visit yet."} Bill only if the visit happened as booked.</p>
          )}
          <p className="sub">{handOver(confirm)
            ? "This drafts the invoice. Nothing is emailed: hand it over, then Mark issued under Needs attention."
            : "This drafts the invoice and its email. Nothing is sent until you approve it under Ready to send."}</p>
        </ConfirmSheet>
      )}
    </>
  );
}
