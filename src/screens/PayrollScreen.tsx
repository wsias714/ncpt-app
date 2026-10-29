import { useState } from "react";
import { CopyButton } from "../components/CopyButton.tsx";
import { dayLabel } from "../lib/deadlines.ts";
import { money } from "../lib/parse.ts";
import {
  approveBlockedWhy, blockers, canApproveRun, copyAmount, type ApprovalAction, type ApprovalState, type Check, type FilingLine, type Leg, type PayrollRun, type RunAmount,
} from "../lib/payroll.ts";

export interface PayrollProps {
  run: PayrollRun | null; // null: App Payroll not published yet
  recorded: { action: ApprovalAction; fingerprint: string } | null; // this session only
  onAct: (action: ApprovalAction, run: PayrollRun) => Promise<void>;
}

const STATE_LABEL: Record<ApprovalState, string> = { approved: "Approved", stale: "Approval stale", none: "Not approved", revoked: "Revoked" };
const STATE_CLASS: Record<ApprovalState, string> = { approved: "done", stale: "month", none: "blocked", revoked: "overdue" };
const LEG_CLASS: Record<Leg["status"], string> = { matched: "done", pending: "month", mismatch: "overdue", "n/a": "blocked" };
const CHECK_CLASS: Record<Check["status"], string> = { ok: "done", warn: "month", block: "overdue" };
const CHECK_WORD: Record<Check["status"], string> = { ok: "ok", warn: "warn", block: "blocks" };
// The amounts a person approves, in the order they read them.
const CONFIRM_KEYS = ["gross", "fed_pit", "ca_pit", "sdi", "deferral", "match", "cash", "correction", "eftps", "edd"];
const FORM_TITLE: Record<string, string> = { "941": "Form 941", de9: "DE 9", de9c: "DE 9C" };

function Fig({ label, value, copy, sub }: { label: string; value: string; copy?: string; sub?: string }) {
  return (
    <li className="figrow">
      <div className="grow"><div>{label}</div>{sub && <div className="sub">{sub}</div>}</div>
      <div className="amt">{value}</div>
      {copy ? <CopyButton value={copy} label={label} /> : <span className="copyspace" />}
    </li>
  );
}

function ConfirmSheet({ action, run, busy, err, onGo, onBack }: { action: ApprovalAction; run: PayrollRun; busy: boolean; err: string; onGo: () => void; onBack: () => void }) {
  const rows = CONFIRM_KEYS.map((k) => run.amounts.find((a) => a.key === k)).filter((a): a is RunAmount => !!a);
  return (
    <div className="scrim" onClick={onBack}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={action === "APPROVE" ? "Approve payroll run" : "Revoke approval"} onClick={(e) => e.stopPropagation()}>
        <h3>{action === "APPROVE" ? `Approve the ${run.ref} payroll run?` : `Revoke the approval for ${run.ref}?`}</h3>
        {action === "APPROVE" && (
          <>
            <p className="sub">You are approving these exact amounts. If any figure changes later, this approval goes stale and you approve again.</p>
            <ul className="list">
              {rows.map((a) => <li key={a.key} className="row"><span>{a.label}</span><span className="amt">{a.amount === null ? "n/a" : money(a.amount)}</span></li>)}
            </ul>
          </>
        )}
        <p><strong>Payments, filings and portal sign-ins stay manual.</strong> This only records your approval in the sheet.</p>
        {err && <p className="warn">{err}</p>}
        <div className="btnrow">
          <button className="btn big" disabled={busy} onClick={onGo}>{busy ? "Saving..." : action === "APPROVE" ? "Approve run" : "Revoke"}</button>
          <button className="btn alt" disabled={busy} onClick={onBack}>Back</button>
        </div>
      </div>
    </div>
  );
}

function Legs({ legs }: { legs: Leg[] }) {
  return (
    <ul className="list">
      {legs.map((l) => (
        <li key={l.key} className="leg">
          <div className="row">
            <div className="grow">
              <div className="dtitle">{l.label}</div>
              <div className="sub">{l.clearBy ? `clear by ${dayLabel(l.clearBy)}` : "no date"}{l.portal && <> - <a href={l.portal} target="_blank" rel="noreferrer">portal</a></>}</div>
              {l.status === "matched" && l.clearedOn && <div className="sub">cleared {dayLabel(l.clearedOn)}{l.clearedAmount !== null ? ` for ${money(l.clearedAmount)}` : ""}</div>}
              {l.status === "matched" && l.personalOn && <div className="sub">also arrived in the personal account {dayLabel(l.personalOn)}</div>}
              {l.status === "mismatch" && <div className="sub warn">bank shows {l.clearedAmount !== null ? money(l.clearedAmount) : "a different amount"}{l.diff !== null ? ` (${l.diff > 0 ? "+" : ""}${money(l.diff)} off)` : ""}{l.clearedOn ? ` on ${dayLabel(l.clearedOn)}` : ""}</div>}
            </div>
            <span className={"dchip " + LEG_CLASS[l.status]}>{l.status}</span>
          </div>
          {l.expected !== null && (
            <div className="figrow nob"><div className="grow sub">Amount to send</div><div className="amt">{money(l.expected)}</div><CopyButton value={copyAmount(l.expected)} label={l.label} /></div>
          )}
        </li>
      ))}
    </ul>
  );
}

function Filing({ lines }: { lines: FilingLine[] }) {
  const groups: { form: string; due: string; items: FilingLine[] }[] = [];
  for (const f of lines) {
    const form = FORM_TITLE[f.key.split(".")[0]] ?? f.key.split(".")[0];
    const g = groups.find((x) => x.form === form);
    if (g) g.items.push(f); else groups.push({ form, due: f.due, items: [f] });
  }
  return (
    <>
      {groups.map((g) => (
        <div key={g.form}>
          <h4>{g.form}{g.due && <span className="muted"> due {dayLabel(g.due)}</span>}</h4>
          <ul className="list">
            {g.items.map((f) => f.amount !== null
              ? <Fig key={f.key} label={f.label} value={/^number of employees/i.test(f.label) ? String(f.amount) : money(f.amount)} copy={/^number of employees/i.test(f.label) ? String(f.amount) : copyAmount(f.amount)} sub={f.detail} />
              : <Fig key={f.key} label={f.label} value={f.detail.length <= 24 ? f.detail : ""} copy={f.detail && f.detail.length <= 24 ? f.detail : undefined} sub={f.detail.length > 24 ? f.detail : undefined} />)}
          </ul>
        </div>
      ))}
    </>
  );
}

export function PayrollScreen({ run, recorded, onAct }: PayrollProps) {
  const [confirm, setConfirm] = useState<ApprovalAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!run) return <section><h2>Payroll run</h2><p className="muted">The quarter's payroll run has not been published yet. It appears here after the next publish.</p></section>;

  const act = async (a: ApprovalAction) => {
    setBusy(true); setErr("");
    try { await onAct(a, run); setConfirm(null); } catch (e) { setErr(e instanceof Error ? e.message : "Could not save"); }
    finally { setBusy(false); }
  };
  const fresh = recorded && recorded.fingerprint === run.fingerprint ? recorded : null; // recorded this session for this exact run
  const blocked = blockers(run);
  const order = { block: 0, warn: 1, ok: 2 } as const;
  const checks = [...run.checks].sort((a, b) => order[a.status] - order[b.status]);
  const canApprove = canApproveRun(run);
  const why = approveBlockedWhy(run);
  const state = run.approval;
  const showApprove = state !== "approved" && !(fresh?.action === "APPROVE");
  const showRevoke = (state === "approved" || state === "stale") && fresh?.action !== "REVOKE";

  return (
    <section>
      <h2>Payroll run {run.ref} <span className={"dchip " + STATE_CLASS[state]}>{STATE_LABEL[state]}</span></h2>
      <p className="sub">The app never pays, files or signs in anywhere. It shows the figures to copy and records your approval; you make the payments and filings yourself.</p>
      {run.built && <p className="sub">Run sheet built {run.built.replace("T", " ")}{run.runBy ? `, payroll run by ${dayLabel(run.runBy)}` : ""}.</p>}

      {!run.trackerOk && <p className="warn">{run.trackerWhy || "The payroll tracker was not reachable at the last publish."} Nothing can be approved until it is.</p>}

      {run.amounts.length > 0 && (
        <>
          <div className="card">
            <h3>Approval</h3>
            {state !== "none" && run.approvalDetail && <p className="sub">{run.approvalDetail}</p>}
            {state === "stale" && <p className="warn">The figures changed since this was approved. Review them and approve again.</p>}
            {fresh && <p className="ok">{fresh.action === "APPROVE" ? "Approval recorded." : "Revoke recorded."} The state above updates at the next publish; tap Refresh later.</p>}
            {showApprove && (
              <>
                <button className="btn big" disabled={!canApprove} onClick={() => { setErr(""); setConfirm("APPROVE"); }}>{state === "stale" ? "Approve again" : "Approve run"}</button>
                {!canApprove && why && <p className="sub warn">{why}</p>}
              </>
            )}
            {showRevoke && <button className="btn alt" onClick={() => { setErr(""); setConfirm("REVOKE"); }}>Revoke approval</button>}
          </div>

          <h3>Checks <span className="muted">{blocked.length > 0 ? `${blocked.length} blocking` : "none blocking"}</span></h3>
          <ul className="list">
            {checks.map((c) => (
              <li key={c.id} className="chk">
                <div className="row">
                  <div className="grow"><div className={c.status === "block" ? "dtitle warn" : "dtitle"}>{c.label}</div><div className="sub">{c.detail}</div></div>
                  <span className={"dchip " + CHECK_CLASS[c.status]}>{CHECK_WORD[c.status]}</span>
                </div>
              </li>
            ))}
          </ul>

          <h3>Run amounts</h3>
          <ul className="list">
            {run.amounts.map((a) => <Fig key={a.key} label={a.label} value={a.amount === null ? "n/a" : money(a.amount)} copy={a.amount === null ? undefined : copyAmount(a.amount)} />)}
          </ul>
        </>
      )}

      {run.legs.length > 0 && (
        <>
          <h3>Payments to make <span className="muted">{run.legs.filter((l) => l.status === "matched").length} of {run.legs.length} cleared</span></h3>
          <p className="sub">Each leg turns matched when the bank shows exactly this amount. Pay it yourself, then Refresh.</p>
          <Legs legs={run.legs} />
        </>
      )}

      {run.filing.length > 0 && (
        <>
          <h3>Filing figures</h3>
          <p className="sub">Type these into the 941 and EDD forms yourself. Copy gives the plain number.</p>
          <Filing lines={run.filing} />
        </>
      )}

      {run.amounts.length === 0 && run.trackerOk && <p className="muted">This quarter's figures are not in the run sheet yet.</p>}

      {confirm && <ConfirmSheet action={confirm} run={run} busy={busy} err={err} onGo={() => act(confirm)} onBack={() => setConfirm(null)} />}
    </section>
  );
}
