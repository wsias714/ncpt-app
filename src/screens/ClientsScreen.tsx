import { useState } from "react";
import { BarChart, LineChart } from "../components/Chart.tsx";
import { useLabel } from "../components/NamesContext.tsx";
import { byClient, byMonth, byYear, clientYears, inRange, summarize, visitsText } from "../lib/clients.ts";
import type { Model } from "../lib/model.ts";
import { money } from "../lib/parse.ts";

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function ClientsScreen({ m }: { m: Model }) {
  const label = useLabel();
  const [range, setRange] = useState("ALL");
  if (m.clients.length === 0) return <section><h2>Clients</h2><p className="muted">Client history has not been published yet.</p></section>;
  const asOf = m.summary.asOf || m.today;
  const rows = inRange(m.clients, range, asOf);
  const t = summarize(rows);
  const years = byYear(inRange(m.clients, "ALL", asOf));
  const months = byMonth(rows);
  const list = byClient(rows, m.clients);
  const top = list[0], top3 = list.slice(0, 3).reduce((a, c) => a + c.share, 0);
  const yearsAsc = [...years].reverse();
  return (
    <section>
      <h2>Clients</h2>
      <div className="filters">
        <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Range">
          <option value="ALL">All time</option>
          <option value="12M">Last 12 months</option>
          {clientYears(m.clients).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className="grid">
        <div className="card"><div className="label">Invoiced</div><div className="value">{money(t.revenue)}</div></div>
        <div className="card"><div className="label">Visits</div><div className="value">{visitsText(t.visits)}</div></div>
        <div className="card"><div className="label">Clients seen</div><div className="value">{t.clients}</div></div>
        <div className="card"><div className="label">Per visit</div><div className="value">{money(t.perVisit)}</div></div>
        <div className="card"><div className="label">Collected</div><div className="value">{money(t.collected)}</div></div>
        <div className="card"><div className="label">Top client share</div><div className="value">{top ? pct(top.share) : "n/a"}</div>
          {top && <div className="muted">Top 3: {pct(top3)}</div>}</div>
      </div>

      <h3>By year</h3>
      <ul className="list">
        <li className="clhead"><strong>Year</strong><strong>Invoiced</strong><strong>Visits</strong><strong>Clients</strong><strong>New</strong><strong>Per visit</strong></li>
        {years.map((y) => (
          <li key={y.year} className="clrow"><span>{y.year}</span><span>{money(y.revenue)}</span><span>{visitsText(y.visits)}</span><span>{y.clients}</span><span>{y.newClients}</span><span>{money(y.perVisit)}</span></li>
        ))}
      </ul>
      <BarChart title="Invoiced by year" labels={yearsAsc.map((y) => y.year)} series={[{ name: "Invoiced", color: "var(--accent)", values: yearsAsc.map((y) => y.revenue) }]} />
      <BarChart title="Visits by year" labels={yearsAsc.map((y) => y.year)} series={[{ name: "Visits", color: "var(--accent)", values: yearsAsc.map((y) => y.visits) }]} fmt={(n) => visitsText(n)} />

      <h3>By month</h3>
      <BarChart title="Invoiced by month" labels={months.map((p) => p.month)} series={[{ name: "Invoiced", color: "var(--accent)", values: months.map((p) => p.revenue) }]} />
      <BarChart title="Visits by month" labels={months.map((p) => p.month)} series={[{ name: "Visits", color: "var(--accent)", values: months.map((p) => p.visits) }]} fmt={(n) => visitsText(n)} />
      <LineChart title="Clients seen by month" labels={months.map((p) => p.month)} series={[{ name: "Clients", color: "var(--accent)", values: months.map((p) => p.clients) }]} fmt={(n) => String(n)} />

      <h3>By client</h3>
      <ul className="list">
        <li className="clhead2"><strong>Client</strong><strong>Invoiced</strong><strong>Visits</strong><strong>Share</strong></li>
        {list.map((c) => (
          <li key={c.code} className="clrow2">
            <span className="grow">{label(c.code)}<span className="muted"> {c.first === c.last ? c.first : `${c.first} to ${c.last}`}</span></span>
            <span>{money(c.revenue)}</span><span>{visitsText(c.visits)}</span><span>{pct(c.share)}</span>
          </li>
        ))}
      </ul>
      <p className="sub">Invoiced is by invoice date, from every Wave invoice since 2019. A visit is a treatment, evaluation or wellness line; an invoice of procedure lines counts as one.</p>
    </section>
  );
}
