import { useState } from "react";
import { useLabel } from "../components/NamesContext.tsx";
import { UpcomingList } from "../components/UpcomingList.tsx";
import { ConfirmSheet } from "../components/ConfirmSheet.tsx";
import { AwaitingOk, type MatchAnswers } from "../components/MatchCards.tsx";
import { canApprove, cardState, type MarkAction, type OutboxItem, type OutboxRequest } from "../lib/outbox.ts";
import { invoiceStats, money, type ArItem, type Decision, type Match, type MatchChoice } from "../lib/parse.ts";
import type { UpcomingRow } from "../lib/upcoming.ts";
import { AwaitingPayment, NeedsAttention, RecentlyPaid } from "./ArScreen.tsx";

export type Requested = ReadonlyMap<string, OutboxRequest>; // this session only, by invoice number

interface Props {
  items: ArItem[]; today: string;
  upcoming: UpcomingRow[] | null; // App Upcoming; null: could not load
  upToday: string;                // Pacific date, for the 7-day list
  requestedVisits: ReadonlySet<string>; // App Upcoming keys asked for this session
  onDraftVisit: (r: UpcomingRow) => Promise<void>;
  outbox: OutboxItem[] | null; // null: not loaded (names off, or not signed in)
  outboxNote?: string;         // why it did not load, when it failed (shown instead of the names-off hint)
  requested: Requested;
  onSend: (i: OutboxItem) => Promise<void>;
  onCancel: (i: OutboxItem) => Promise<void>;
  onCloseOut: (i: OutboxItem) => Promise<void>; // no email: discard the draft, issue the invoice, the deposit closes it
  marked: ReadonlyMap<string, MarkAction>; // this session only, by invoice number
  onMark: (i: ArItem, a: MarkAction) => Promise<void>;
  matches?: Match[] | null;       // App Matches: proposed deposit matches; null/undefined: not published
  matchAnswers?: MatchAnswers;    // answered this session, by Match id
  latest?: ReadonlyMap<string, Decision>;
  onMatchAnswer?: (m: Match, choice: MatchChoice) => Promise<void>;
}

function Preview({ i, requested, onSend, onCancel, onCloseOut }: { i: OutboxItem; requested?: OutboxRequest; onSend: Props["onSend"]; onCancel: Props["onCancel"]; onCloseOut: Props["onCloseOut"] }) {
  const label = useLabel();
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const state = cardState(requested);
  const run = async (f: () => Promise<void>) => {
    setBusy(true); setErr("");
    try { await f(); setConfirm(false); } catch (e) { setErr(e instanceof Error ? e.message : "Could not save"); }
    finally { setBusy(false); }
  };
  return (
    <li className="card mail">
      <div className="row">
        <div><strong>{label(i.code)}</strong><div className="sub">Invoice {i.number} - due {i.due}</div></div>
        <div className="right"><strong>{money(i.total)}</strong></div>
      </div>
      {i.lines && <div className="sub">{i.lines}</div>}
      <dl className="mailhead">
        <dt>To</dt><dd>{i.to || <span className="warn">no recipient on the draft</span>}</dd>
        {i.cc && <><dt>Cc</dt><dd>{i.cc}</dd></>}
        <dt>Subject</dt><dd>{i.subject}</dd>
        <dt>Attached</dt><dd>{i.pdf ? <a href={i.pdf} target="_blank" rel="noreferrer">{i.attachment || "invoice PDF"}</a> : (i.attachment || <span className="warn">no PDF</span>)}</dd>
      </dl>
      <pre className="mailbody">{i.body}</pre>
      {state.closedOut ? (
        <>
          <p className="ok">Closed out. The draft is discarded within about a minute; Refresh to see it under Awaiting payment.</p>
          <button className="btn big" disabled={state.approveDisabled}>Approve and send</button>
        </>
      ) : state.sendRequested ? (
        <>
          <p className="ok">Approved. It goes out within about a minute; Refresh to see it under Sent.</p>
          <button className="btn" disabled={busy} onClick={() => run(() => onCancel(i))}>Cancel send</button>
        </>
      ) : confirm ? (
        <>
          <p><strong>Send invoice {i.number} for {money(i.total)} to {i.to}?</strong> This emails it from the NCPT account and cannot be undone.</p>
          <div className="btnrow">
            <button className="btn big" disabled={busy} onClick={() => run(() => onSend(i))}>{busy ? "Saving..." : "Send now"}</button>
            <button className="btn alt" disabled={busy} onClick={() => setConfirm(false)}>Back</button>
          </div>
        </>
      ) : (
        <>
          <button className="btn big" disabled={!canApprove(i)} onClick={() => setConfirm(true)}>Approve and send</button>
          <button className="btn alt" onClick={() => setClosing(true)}>No email: close out with the deposit</button>
        </>
      )}
      {closing && (
        <ConfirmSheet title={label(i.code)} confirmLabel="Confirm" onConfirm={() => onCloseOut(i)} onClose={() => setClosing(false)}>
          <p><strong>Close out invoice {i.number} for {money(i.total)} without emailing?</strong> It counts as issued and waits for the deposit to match. The email draft is discarded.</p>
        </ConfirmSheet>
      )}
      {requested === "CANCEL" && <p className="sub">Send cancelled. Nothing was emailed.</p>}
      {err && <p className="warn">{err}</p>}
    </li>
  );
}

// Top to bottom: Awaiting your OK (proposed deposit matches, App Matches), To do (App Upcoming), Ready to send (App Outbox previews, names on only), Needs attention (drafts
// with no email), Awaiting payment, Recently paid. Everything except the previews works with names off.
export function InvoicesScreen(p: Props) {
  const { items, today, outbox, outboxNote, requested, onSend, onCancel, onCloseOut } = p;
  const label = useLabel();
  const st = invoiceStats(items, today);
  const ready = (outbox ?? []).filter((i) => i.status === "READY");
  const sent = (outbox ?? []).filter((i) => i.status === "SENT");
  return (
    <section>
      <h2>Invoices</h2>
      {p.onMatchAnswer && <AwaitingOk matches={p.matches ?? null} answers={p.matchAnswers ?? new Map()} latest={p.latest ?? new Map()} onAnswer={p.onMatchAnswer} />}
      <UpcomingList rows={p.upcoming} today={p.upToday} requested={p.requestedVisits} onCreate={p.onDraftVisit} />

      <h3>Ready to send <span className="muted">{outbox === null ? st.readyToSend.length : ready.length}</span></h3>
      {outbox === null ? (
        <p className={outboxNote ? "warn" : "sub"}>{outboxNote || `Email previews and Approve and send appear only with Names on, because a preview shows who it goes to.${st.readyToSend.length ? ` ${st.readyToSend.length} waiting (${money(st.readyToSendTotal)}).` : ""} Turn Names on at the top, then Refresh.`}</p>
      ) : (
        <>
          {ready.length === 0 && <p className="muted">Nothing waiting. Tap Create invoice above once a visit is over.</p>}
          <ul className="list">
            {ready.map((i) => <Preview key={i.number} i={i} requested={requested.get(i.number)} onSend={onSend} onCancel={onCancel} onCloseOut={onCloseOut} />)}
          </ul>
          {sent.length > 0 && (
            <>
              <h4>Sent, last 30 days</h4>
              <ul className="list">
                {sent.map((i) => (
                  <li key={i.number} className="row">
                    <div><strong>{label(i.code)}</strong><div className="sub">Invoice {i.number}</div></div>
                    <div className="right"><div>{money(i.total)}</div><div className="sub">{i.prepared.slice(0, 10)}</div></div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <NeedsAttention items={st.needsAttention} marked={p.marked} onMark={p.onMark} />
      <AwaitingPayment st={st} today={today} />
      <RecentlyPaid st={st} />
    </section>
  );
}
