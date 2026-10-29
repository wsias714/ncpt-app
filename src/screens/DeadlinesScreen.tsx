import { band, dayLabel, daysLabel, groupDeadlines, weekLabel, type Deadline } from "../lib/deadlines.ts";

export function DeadlineChip({ d }: { d: Deadline }) {
  return <span className={"dchip " + band(d.daysLeft, d.state)}>{daysLabel(d)}</span>;
}

function Row({ d }: { d: Deadline }) {
  const meta = [d.method, d.level].filter(Boolean).join(" - ");
  return (
    <li className="deadline">
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
        </div>
        <div className="right"><DeadlineChip d={d} />{(d.state === "verify" || d.state === "undated") && d.due && <div className="sub">verify</div>}</div>
      </div>
    </li>
  );
}

const Fold = ({ title, items }: { title: string; items: Deadline[] }) =>
  items.length === 0 ? null : (
    <details className="fold">
      <summary>{title} <span className="muted">{items.length}</span></summary>
      <ul className="list">{items.map((d) => <Row key={d.id + d.period} d={d} />)}</ul>
    </details>
  );

export function DeadlinesScreen({ rows }: { rows: Deadline[] }) {
  if (rows.length === 0) return <section><h2>Deadlines</h2><p className="muted">Deadlines have not been published yet.</p></section>;
  const g = groupDeadlines(rows);
  const none = g.overdue.length === 0 && g.weeks.length === 0;
  return (
    <section>
      <h2>Deadlines <span className="muted">next 90 days</span></h2>
      {none && <p className="muted">Nothing due in the next 90 days.</p>}
      {g.overdue.length > 0 && (
        <>
          <h3 className="warn">Overdue <span className="muted">{g.overdue.length}</span></h3>
          <ul className="list">{g.overdue.map((d) => <Row key={d.id + d.period} d={d} />)}</ul>
        </>
      )}
      {g.weeks.map((w) => (
        <div key={w.start}>
          <h3>{weekLabel(w.start)}</h3>
          <ul className="list">{w.items.map((d) => <Row key={d.id + d.period} d={d} />)}</ul>
        </div>
      ))}
      {g.verify.length > 0 && (
        <>
          <h3>Undated / to verify <span className="muted">{g.verify.length}</span></h3>
          <ul className="list">{g.verify.map((d) => <Row key={d.id + d.period} d={d} />)}</ul>
        </>
      )}
      <Fold title="Later than 90 days" items={g.later} />
      <Fold title="Exempt" items={g.exempt} />
      {g.doneEarlier > 0 && <p className="sub">{g.doneEarlier} finished earlier are hidden.</p>}
    </section>
  );
}
