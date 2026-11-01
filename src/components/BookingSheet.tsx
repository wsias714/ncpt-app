import { useState } from "react";
import { useLabel } from "./NamesContext.tsx";
import { accountPickerOrder, decisionProblem, IGNORE, isPending, money, rejection, type Account, type Decision, type Tx } from "../lib/parse.ts";

interface Props {
  tx: Tx;
  accounts: Account[];
  latest: Decision | undefined;
  onSave: (account: string, note: string) => Promise<void>;
  onClose: () => void;
}

export function BookingSheet({ tx, accounts, latest, onSave, onClose }: Props) {
  const label = useLabel();
  const start = latest?.account ?? tx.code;
  const [account, setAccount] = useState(start.toUpperCase() === IGNORE ? IGNORE : start);
  const [note, setNote] = useState("");
  const ignoring = account === IGNORE;
  const problem = decisionProblem(account, note);
  const latestMap = new Map(latest ? [[tx.entry, latest]] : []);
  const rejected = rejection(tx, latestMap);
  const pending = isPending(tx, latestMap);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ordered = accountPickerOrder(accounts);
  const groups: [string, Account[]][] = [
    ["Income", ordered.filter((a) => a.type === "income")],
    ["Expense", ordered.filter((a) => a.type === "expense")],
    ["Other", ordered.filter((a) => a.type !== "income" && a.type !== "expense")],
  ];

  const save = async () => {
    setBusy(true); setErr("");
    try { await onSave(account, note); onClose(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Could not save"); setBusy(false); }
  };

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Book transaction" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <div>
            <strong>{label(tx.description) || "(no description)"}</strong>
            <div className="sub">{tx.date} - {tx.account}</div>
          </div>
          <div className="right"><strong className={tx.amount < 0 ? "" : "pos"}>{money(tx.amount)}</strong></div>
        </div>
        <p className="sub">Now: {tx.code ? tx.category : "not booked"}{pending && latest ? ` - pending ${latest.account.toUpperCase() === IGNORE ? "ignore" : accounts.find((a) => a.code === latest.account)?.name ?? "change"}` : ""}</p>
        {rejected && <p className="warn small">The last change was not applied: {rejected}.</p>}
        {tx.locked ? (
          <p className="warn">Closed month: ask Wade to unlock.</p>
        ) : (
          <>
            <label className="field">Book to
              <select value={account} onChange={(e) => setAccount(e.target.value)}>
                <option value="">Choose an account</option>
                <optgroup label="Keep out of the books">
                  <option value={IGNORE}>Ignore this line</option>
                </optgroup>
                {groups.map(([title, list]) => list.length > 0 && (
                  <optgroup key={title} label={title}>
                    {list.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="field">{ignoring ? "Why ignore it? (required)" : "Note (optional)"}
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} aria-required={ignoring} />
            </label>
            {ignoring && <p className="sub">Do not type a name. Example: moved between our own accounts. An ignored line stays out of the books and shows as a reconciling item on the bank rec.</p>}
            <p className="sub">Applies at the next publish (hourly).</p>
            {err && <p className="warn">{err}</p>}
          </>
        )}
        <div className="actions">
          <button className="link" onClick={onClose}>{tx.locked ? "Close" : "Cancel"}</button>
          {!tx.locked && <button className="btn" onClick={save} disabled={busy || !!problem} title={problem}>{busy ? "Saving..." : "Save"}</button>}
        </div>
      </div>
    </div>
  );
}
