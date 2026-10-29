import { useState } from "react";
import { useLabel } from "../components/NamesContext.tsx";
import { canApprove, type OutboxItem } from "../lib/outbox.ts";
import { money, type ArItem } from "../lib/parse.ts";
import { ArScreen } from "./ArScreen.tsx";

export type Requested = ReadonlyMap<string, "SEND" | "CANCEL">; // this session only, by invoice number

interface Props {
  items: ArItem[]; today: string;
  outbox: OutboxItem[] | null; // null: not loaded (names off, or not signed in)
  requested: Requested;
  onSend: (i: OutboxItem) => Promise<void>;
  onCancel: (i: OutboxItem) => Promise<void>;
  onDraft: () => Promise<void>;
}

function Preview({ i, requested, onSend, onCancel }: { i: OutboxItem; requested?: "SEND" | "CANCEL"; onSend: Props["onSend"]; onCancel: Props["onCancel"] }) {
  const label = useLabel();
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
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
      {requested === "SEND" ? (
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
        <button className="btn big" disabled={!canApprove(i)} onClick={() => setConfirm(true)}>Approve and send</button>
      )}
      {requested === "CANCEL" && <p className="sub">Send cancelled. Nothing was emailed.</p>}
      {err && <p className="warn">{err}</p>}
    </li>
  );
}

export function InvoicesScreen({ items, today, outbox, requested, onSend, onCancel, onDraft }: Props) {
  const label = useLabel();
  const [drafting, setDrafting] = useState(false);
  const [note, setNote] = useState("");
  const ready = (outbox ?? []).filter((i) => i.status === "READY");
  const sent = (outbox ?? []).filter((i) => i.status === "SENT");
  const draft = async () => {
    setDrafting(true); setNote("");
    try { await onDraft(); setNote("Asked for new invoices. They appear here within about a minute; tap Refresh."); }
    catch (e) { setNote(e instanceof Error ? e.message : "Could not save"); }
    finally { setDrafting(false); }
  };
  return (
    <section>
      <h2>Invoices</h2>
      {outbox === null ? (
        <p className="muted">Sending is available only with Names on, because the email preview shows who it goes to.</p>
      ) : (
        <>
          <button className="btn" onClick={draft} disabled={drafting}>{drafting ? "Saving..." : "Create invoices from visits"}</button>
          {note && <p className="sub">{note}</p>}
          <h3>Ready to send <span className="muted">{ready.length}</span></h3>
          {ready.length === 0 && <p className="muted">Nothing waiting. New visit notes become drafts here.</p>}
          <ul className="list">
            {ready.map((i) => <Preview key={i.number} i={i} requested={requested.get(i.number)} onSend={onSend} onCancel={onCancel} />)}
          </ul>
          {sent.length > 0 && (
            <>
              <h3>Sent, last 30 days</h3>
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
      <ArScreen items={items} today={today} previewed={outbox === null ? undefined : new Set(ready.map((i) => i.number))} />
    </section>
  );
}
