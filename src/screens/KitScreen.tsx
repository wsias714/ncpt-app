import { useState } from "react";
import { CopyButton } from "../components/CopyButton.tsx";
import { band, dayLabel, daysLabel, type Deadline } from "../lib/deadlines.ts";
import { filingRow, validateFiling, type FilingInput } from "../lib/filings.ts";
import { deadlinesForKit, failingTies, yearEndTies, type Kit, type KitStatus } from "../lib/kits.ts";
import type { Who } from "../lib/who.ts";

export const kitKey = (k: { id: string; period: string }) => k.id + "|" + k.period;

export interface KitProps {
  kits: Kit[];
  deadlines: Deadline[];
  today: string;
  selected: string | null; // kitKey of the open kit
  onSelect: (key: string | null) => void;
  filed: ReadonlySet<string>; // "Id|Period" recorded this session (memory only)
  onFile: (rows: string[][], keys: string[]) => Promise<void>;
  who: Who;
}

const STATUS_CLASS: Record<KitStatus, string> = { ready: "done", verify: "month", check: "overdue", blocked: "blocked" };
const STATUS_WORD: Record<KitStatus, string> = { ready: "ready", verify: "verify", check: "tie fails", blocked: "blocked" };
const TIE_CLASS = { ok: "done", FAIL: "overdue", "n/a": "blocked" } as const;

function Ties({ kit }: { kit: Kit }) {
  if (kit.ties.length === 0) return null;
  return (
    <ul className="list">
      {kit.ties.map((t) => (
        <li key={t.name || t.label} className="chk">
          <div className="row">
            <div className="grow">
              <div className={t.status === "FAIL" ? "dtitle warn" : "dtitle"}>{t.label}</div>
              <div className="sub">{t.value}{t.note ? ` - ${t.note}` : ""}</div>
            </div>
            <span className={"dchip " + TIE_CLASS[t.status]}>{t.status}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

interface Target { id: string; period: string; title: string; method: string }

function FiledForm({ kit, targets, today, filed, onFile, who }: { kit: Kit; targets: Target[]; today: string; filed: ReadonlySet<string>; onFile: KitProps["onFile"]; who: Who }) {
  const open = targets.filter((t) => !filed.has(t.id + "|" + t.period));
  const [picked, setPicked] = useState<string[]>(() => open.map((t) => t.id + "|" + t.period));
  const [confirmation, setConfirmation] = useState("");
  const [amount, setAmount] = useState("");
  const [filedOn, setFiledOn] = useState(today);
  const [method, setMethod] = useState(targets[0]?.method ?? "");
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<string[]>([]);

  if (open.length === 0) return <p className="ok">Recorded as filed. The deadline turns done at the next publish; tap Refresh later.</p>;
  if (kit.blocked.length > 0) return <p className="sub warn">This kit is blocked, so it cannot be recorded as filed yet.</p>;

  const chosen = open.filter((t) => picked.includes(t.id + "|" + t.period));
  const inputs: FilingInput[] = chosen.map((t) => ({ id: t.id, period: t.period, confirmation, amount, filedOn, method }));
  const problems = (): string[] => (chosen.length === 0 ? ["Pick at least one item."] : [...new Set(inputs.flatMap(validateFiling))]);
  const toReview = () => { const p = problems(); setErrs(p); if (p.length === 0) setReview(true); };
  const save = async () => {
    setBusy(true); setErrs([]);
    try { await onFile(inputs.map((i) => filingRow(i, who)), chosen.map((t) => t.id + "|" + t.period)); setReview(false); }
    catch (e) { setErrs([e instanceof Error ? e.message : "Could not save"]); }
    finally { setBusy(false); }
  };

  if (review) {
    return (
      <div>
        <p><strong>Record {chosen.map((t) => t.title).join(" and ")} as filed?</strong></p>
        <dl className="mailhead">
          <dt>For</dt><dd>{chosen.map((t) => `${t.id} ${t.period}`).join(", ")}</dd>
          <dt>Confirmation</dt><dd>{confirmation.trim()}</dd>
          <dt>Amount</dt><dd>{amount.trim() ? Number(amount.replace(/[$,]/g, "")).toFixed(2) : "none"}</dd>
          <dt>Filed on</dt><dd>{dayLabel(filedOn.trim())}</dd>
          <dt>Method</dt><dd>{method.trim() || "not given"}</dd>
        </dl>
        <p className="sub">This only records that you filed it, so the deadline can turn done. The app files nothing.</p>
        {errs.map((e) => <p key={e} className="warn">{e}</p>)}
        <div className="btnrow">
          <button className="btn big" disabled={busy} onClick={save}>{busy ? "Saving..." : "Record as filed"}</button>
          <button className="btn alt" disabled={busy} onClick={() => setReview(false)}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {open.length > 1 && (
        <div className="field">Record for
          {open.map((t) => {
            const k = t.id + "|" + t.period;
            return (
              <label key={k} className="check pick">
                <input type="checkbox" checked={picked.includes(k)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, k] : p.filter((x) => x !== k)))} />
                {t.title}
              </label>
            );
          })}
        </div>
      )}
      <label className="field">Confirmation number
        <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" spellCheck={false} />
      </label>
      <label className="field">Amount paid or reported (optional)
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" autoComplete="off" />
      </label>
      <label className="field">Filed on
        <input type="date" value={filedOn} onChange={(e) => setFiledOn(e.target.value)} />
      </label>
      <label className="field">Method
        <input value={method} onChange={(e) => setMethod(e.target.value)} autoComplete="off" />
      </label>
      {errs.map((e) => <p key={e} className="warn">{e}</p>)}
      <button className="btn big" onClick={toReview}>Review</button>
    </div>
  );
}

function Detail({ kit, deadlines, today, filed, onFile, who, onBack }: { kit: Kit; deadlines: Deadline[]; today: string; filed: ReadonlySet<string>; onFile: KitProps["onFile"]; who: Who; onBack: () => void }) {
  const found = deadlinesForKit(kit, deadlines);
  const targets: Target[] = found.length > 0
    ? found.map((d) => ({ id: d.id, period: d.period, title: d.title, method: d.method }))
    : [{ id: kit.id, period: kit.period, title: kit.title, method: "" }];
  return (
    <section>
      <button className="link back" onClick={onBack}>All kits</button>
      <h2>{kit.title} <span className="muted">{kit.period}</span> <span className={"dchip " + STATUS_CLASS[kit.status]}>{STATUS_WORD[kit.status]}</span></h2>
      <p className="sub">Type these into the portal yourself. The app files nothing; it only holds the figures to copy and records that you filed.</p>
      {kit.portal && /^https?:\/\//.test(kit.portal) && <p className="sub"><a href={kit.portal} target="_blank" rel="noreferrer">Open the portal</a> (you sign in yourself)</p>}
      {kit.blocked.map((b) => <p key={b} className="warn">Blocked: {b}</p>)}
      {kit.verify.map((v) => <p key={v} className="sub">To verify: {v}</p>)}

      {kit.fields.length > 0 && (
        <ul className="list">
          {kit.fields.map((f) => (
            <li key={f.order + f.line} className="figrow">
              <div className="grow">
                <div className="fieldlabel"><span className="line">{f.line}</span><span>{f.label}</span></div>
                {f.source && <div className="sub">{f.source}</div>}
              </div>
              <div className="amt">{f.display || "-"}</div>
              {f.copy ? <CopyButton value={f.copy} label={`${f.line} ${f.label}`} /> : <span className="copyspace" />}
            </li>
          ))}
        </ul>
      )}

      {kit.ties.length > 0 && (<><h3>Tie-outs <span className="muted">{failingTies(kit).length > 0 ? `${failingTies(kit).length} failing` : "all pass"}</span></h3><Ties kit={kit} /></>)}

      <div className="card filed">
        <h3>Filed</h3>
        <p className="sub">{targets.map((t) => `${t.title} (${t.id}, ${t.period})`).join("; ")}</p>
        <FiledForm key={kitKey(kit)} kit={kit} targets={targets} today={today} filed={filed} onFile={onFile} who={who} />
      </div>
    </section>
  );
}

export function KitScreen({ kits, deadlines, today, selected, onSelect, filed, onFile, who }: KitProps) {
  if (kits.length === 0) return <section><h2>Filing kits</h2><p className="muted">Filing kits have not been published yet. They appear here after the next publish.</p></section>;
  const open = selected ? kits.find((k) => kitKey(k) === selected) : undefined;
  if (open) return <Detail kit={open} deadlines={deadlines} today={today} filed={filed} onFile={onFile} who={who} onBack={() => onSelect(null)} />;

  const items = kits.filter((k) => k.id !== "TIES").map((k) => ({ kit: k, rows: deadlinesForKit(k, deadlines) }));
  const due = (x: { rows: Deadline[] }) => x.rows.map((d) => d.due).filter(Boolean).sort()[0] ?? "9999";
  items.sort((a, b) => due(a).localeCompare(due(b)) || a.kit.title.localeCompare(b.kit.title));
  const ties = yearEndTies(kits);
  return (
    <section>
      <h2>Filing kits</h2>
      <p className="sub">Every figure for a filing, in form order, with Copy buttons. The app never files anything: you type the figures into the portal, then record the confirmation here.</p>
      <ul className="list">
        {items.map(({ kit, rows }) => {
          const d = rows[0];
          const done = rows.length > 0 && rows.every((r) => r.state === "done" || filed.has(r.id + "|" + r.period));
          return (
            <li key={kitKey(kit)} className="kitli">
              <button className="card tap kitrow" onClick={() => onSelect(kitKey(kit))}>
                <div className="row">
                  <div className="grow">
                    <div className="dtitle">{kit.title} <span className="muted">{kit.period}</span></div>
                    <div className="sub">{rows.length > 0 ? rows.map((r) => r.title).join(" and ") : "No matching deadline row"}{d?.due ? ` - due ${dayLabel(d.due)}` : ""}</div>
                    {kit.blocked[0] && <div className="sub warn">Blocked: {kit.blocked[0]}</div>}
                    {failingTies(kit).length > 0 && <div className="sub warn">{failingTies(kit).length} tie-out failing</div>}
                  </div>
                  <div className="right">
                    <span className={"dchip " + (done ? "done" : STATUS_CLASS[kit.status])}>{done ? "filed" : STATUS_WORD[kit.status]}</span>
                    {d && !done && <div className="sub"><span className={"dchip " + band(d.daysLeft, d.state)}>{daysLabel(d)}</span></div>}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {ties.map((k) => (
        <div key={kitKey(k)}>
          <h3>Year-end tie-outs <span className="muted">{k.period}{failingTies(k).length > 0 ? ` - ${failingTies(k).length} failing` : " - all pass"}</span></h3>
          <Ties kit={k} />
        </div>
      ))}
    </section>
  );
}
