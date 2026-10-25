import { money, totalOpen, type ArItem, type Close, type Dashboard } from "../lib/parse.ts";

interface Props { dash: Dashboard; close: Close; ar: ArItem[] }

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function TodayScreen({ dash, close, ar }: Props) {
  const blocked = close.months.filter((m) => m.status === "BLOCKED");
  const items = [...dash.closeBlockers, ...blocked.flatMap((m) => m.blockers.map((b) => `${m.month}: ${b}`))];
  const unique = [...new Set(items)];
  return (
    <section>
      <h2>Today <span className="muted">as of {dash.asOf || "?"}</span></h2>
      <div className="grid">
        <Card label="Cash" value={money(dash.cash)} />
        <Card label="Card owed" value={money(dash.card)} />
        <Card label="Accounts receivable" value={money(dash.ar)} sub={`${ar.length} open, ${money(totalOpen(ar))} listed`} />
        <Card label="Net income, year to date" value={money(dash.ytdNetCash)} sub="cash basis (tax)" />
        <Card label="Last closed month" value={dash.lastClosedMonth || "none yet"} sub={dash.bankRecThrough && `Bank rec: ${dash.bankRecThrough}`} />
        <Card label="To review" value={String(dash.entriesToReview ?? "n/a")} sub="bank entries" />
      </div>
      <h3>Blocked</h3>
      {unique.length === 0 ? <p className="muted">Nothing blocked.</p> : (
        <ul className="list">{unique.map((b) => <li key={b} className="warn">{b}</li>)}</ul>
      )}
    </section>
  );
}
