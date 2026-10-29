import { band, dayLabel, daysLabel, groupDeadlines, weekLabel, type Deadline } from "../lib/deadlines.ts";
import { kitForDeadline, type Kit } from "../lib/kits.ts";
import type { PayrollRun } from "../lib/payroll.ts";
import { kitKey } from "./KitScreen.tsx";

export function DeadlineChip({ d }: { d: Deadline }) {
  return <span className={"dchip " + band(d.daysLeft, d.state)}>{daysLabel(d)}</span>;
}

// Items that belong to the quarterly payroll run (run, EFTPS deposit, EDD deposit).
const PAYROLL_IDS = new Set(["I1", "F2", "C3"]);

interface Links { kits: Kit[]; payroll: PayrollRun | null; openKit: (key: string) => void; openPayroll: () => void }

function Row({ d, links }: { d: Deadline; links: Links }) {
  const meta = [d.method, d.level].filter(Boolean).join(" - ");
  const kit = kitForDeadline(links.kits, d.id, d.period);
  const toPayroll = !kit && PAYROLL_IDS.has(d.id) && !!links.payroll && links.payroll.ref === d.period;
  const go = kit ? () => links.openKit(kitKey(kit)) : toPayroll ? links.openPayroll : null;
  const body = (
    <div className="row">
      <div className="grow">
        <div className="dtitle">{d.title}</div>
        <div className="sub">
          {d.due ? dayLabel(d.due) : "No date"}
          {d.rolled && d.rawDue && d.rawDue !== d.due ? ` (moved from ${dayLabel(d.rawDue)})` : ""}
          {d.period ? ` - for ${d.period}` : ""}
        </div>
        {meta && <div className="sub">{meta}</div>}
        {d.state === "blocked" && d.blocker && <div className="sub warn">Blocked: {d.blocker}</div>}
        {(d.state === "verify" || d.state === "undated") && d.verify && <div className="sub">To verify: {d.verify}</div>}
        {d.note && <div className="sub">{d.note}</div>}
        {go && <div className="sub accent">{kit ? "Open the filing kit" : "Open the payroll run"} &rsaquo;</div>}
      </div>
      <div className="right"><DeadlineChip d={d} />{(d.state === "verify" || d.state === "undated") && d.due && <div className="sub">verify</div>}</div>
    </div>
  );
  return <li className="deadline">{go ? <button className="rowbtn" onClick={go}>{body}</button> : body}</li>;
}

const Fold = ({ title, items, links }: { title: string; items: Deadline[]; links: Links }) =>
  items.length === 0 ? null : (
    <details className="fold">
      <summary>{title} <span className="muted">{items.length}</span></summary>
      <ul className="list">{items.map((d) => <Row key={d.id + d.period} d={d} links={links} />)}</ul>
    </details>
  );

export function DeadlinesScreen({ rows, kits, payroll, openKit, openKits, openPayroll }: {
  rows: Deadline[]; kits: Kit[]; payroll: PayrollRun | null; openKit: (key: string) => void; openKits: () => void; openPayroll: () => void;
}) {
  if (rows.length === 0) return <section><h2>Deadlines</h2><p className="muted">Deadlines have not been published yet.</p></section>;
  const links: Links = { kits, payroll, openKit, openPayroll };
  const g = groupDeadlines(rows);
  const none = g.overdue.length === 0 && g.weeks.length === 0;
  return (
    <section>
      <h2>Deadlines <span className="muted">next 90 days</span></h2>
      {(payroll || kits.length > 0) && (
        <div className="btnrow quick">
          {payroll && <button className="btn alt" onClick={openPayroll}>Payroll run {payroll.ref}</button>}
          {kits.length > 0 && <button className="btn alt" onClick={openKits}>Filing kits</button>}
        </div>
      )}
      {none && <p className="muted">Nothing due in the next 90 days.</p>}
      {g.overdue.length > 0 && (
        <>
          <h3 className="warn">Overdue <span className="muted">{g.overdue.length}</span></h3>
          <ul className="list">{g.overdue.map((d) => <Row key={d.id + d.period} d={d} links={links} />)}</ul>
        </>
      )}
      {g.weeks.map((w) => (
        <div key={w.start}>
          <h3>{weekLabel(w.start)}</h3>
          <ul className="list">{w.items.map((d) => <Row key={d.id + d.period} d={d} links={links} />)}</ul>
        </div>
      ))}
      {g.verify.length > 0 && (
        <>
          <h3>Undated / to verify <span className="muted">{g.verify.length}</span></h3>
          <ul className="list">{g.verify.map((d) => <Row key={d.id + d.period} d={d} links={links} />)}</ul>
        </>
      )}
      <Fold title="Later than 90 days" items={g.later} links={links} />
      <Fold title="Exempt" items={g.exempt} links={links} />
      {g.doneEarlier > 0 && <p className="sub">{g.doneEarlier} finished earlier are hidden.</p>}
    </section>
  );
}
