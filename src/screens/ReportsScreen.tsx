import { useState } from "react";
import { BarChart, LineChart } from "../components/Chart.tsx";
import type { Model } from "../lib/model.ts";
import { money } from "../lib/parse.ts";

type Seg = "is" | "bs" | "trends";
interface Props { m: Model; filterByCode: (code: string) => void }

function Statement({ m, filterByCode }: Props) {
  const p = m.pnl;
  const [basis, setBasis] = useState<"cash" | "accrual">("cash");
  const [period, setPeriod] = useState<string>("ytd"); // month index as string, or "ytd"
  if (p.sections.length === 0) return <p className="muted">The income statement has not been published yet.</p>;
  const ytdCol = p.months.length + (basis === "cash" ? 0 : 1);
  const col = basis === "accrual" || period === "ytd" ? ytdCol : Math.min(Number(period), p.months.length - 1);
  const at = (v: number[]) => v[col] ?? 0;
  return (
    <>
      <div className="filters">
        <select value={basis === "accrual" ? "ytd" : period} onChange={(e) => setPeriod(e.target.value)} disabled={basis === "accrual"} aria-label="Period">
          {p.months.map((mo, i) => <option key={mo + i} value={String(i)}>{mo}</option>)}
          <option value="ytd">Year to date</option>
        </select>
        <div className="seg small" role="group" aria-label="Basis">
          <button className={basis === "cash" ? "on" : ""} onClick={() => setBasis("cash")}>Cash</button>
          <button className={basis === "accrual" ? "on" : ""} onClick={() => setBasis("accrual")}>Accrual</button>
        </div>
      </div>
      {basis === "accrual" && <p className="sub">Accrual is available for the year to date only.</p>}
      {p.sections.map((s) => (
        <div key={s.title}>
          <h3>{s.title}</h3>
          <ul className="list">
            {s.rows.filter((r) => at(r.values) !== 0).map((r) => (
              <li key={r.code}>
                <button className="txrow" onClick={() => filterByCode(r.code)}>
                  <span className="grow">{r.code} {r.name}</span><span>{money(at(r.values))}</span>
                </button>
              </li>
            ))}
            <li className="row total"><strong>Total {s.title.toLowerCase()}</strong><strong>{money(at(s.total))}</strong></li>
          </ul>
        </div>
      ))}
      <div className="row total big2"><strong>Net income ({basis})</strong><strong className={at(p.net) < 0 ? "warn" : ""}>{money(at(p.net))}</strong></div>
      <p className="sub">Tap an account to see its transactions.</p>
    </>
  );
}

function Balance({ m }: { m: Model }) {
  const b = m.bs;
  const [idx, setIdx] = useState(-1);
  if (b.sections.length === 0) return <p className="muted">The balance sheet has not been published yet.</p>;
  const i = idx < 0 ? b.ends.length - 1 : Math.min(idx, b.ends.length - 1);
  return (
    <>
      <div className="filters">
        <select value={i} onChange={(e) => setIdx(Number(e.target.value))} aria-label="As of month end">
          {b.ends.map((e, k) => <option key={e + k} value={k}>As of {e}</option>)}
        </select>
      </div>
      {b.sections.map((s) => (
        <div key={s.title}>
          <h3>{s.title}</h3>
          <ul className="list">
            {s.rows.filter((r) => r.values[i] !== 0).map((r) => (
              <li key={r.code + r.name} className="row"><span>{r.code} {r.name}</span><span>{money(r.values[i])}</span></li>
            ))}
            <li className="row total"><strong>Total {s.title.toLowerCase()}</strong><strong>{money(s.total[i] ?? 0)}</strong></li>
          </ul>
        </div>
      ))}
    </>
  );
}

function Trends({ m }: { m: Model }) {
  const rows = m.monthly.slice(-18);
  if (rows.length === 0) return <p className="muted">Monthly history has not been published yet.</p>;
  const labels = rows.map((r) => r.month);
  return (
    <>
      <BarChart title="Income and expense by month" labels={labels} series={[
        { name: "Income", color: "var(--accent)", values: rows.map((r) => r.income) },
        { name: "Expense", color: "var(--warn)", values: rows.map((r) => r.expense) },
      ]} />
      <BarChart title="Net profit by month (cash)" labels={labels} series={[
        { name: "Net cash", color: "var(--accent)", values: rows.map((r) => r.netCash) },
      ]} />
      <LineChart title="Cash and receivables at month end" labels={labels} series={[
        { name: "Cash", color: "var(--accent)", values: rows.map((r) => r.cashEnd) },
        { name: "Receivable", color: "var(--warn)", values: rows.map((r) => r.arEnd) },
      ]} />
    </>
  );
}

export function ReportsScreen({ m, filterByCode }: Props) {
  const [seg, setSeg] = useState<Seg>("is");
  const s = m.summary;
  return (
    <section>
      <h2>Reports</h2>
      <div className="seg" role="group" aria-label="Report">
        <button className={seg === "is" ? "on" : ""} onClick={() => setSeg("is")}>Income statement</button>
        <button className={seg === "bs" ? "on" : ""} onClick={() => setSeg("bs")}>Balance sheet</button>
        <button className={seg === "trends" ? "on" : ""} onClick={() => setSeg("trends")}>Trends</button>
      </div>
      {seg === "is" && <Statement m={m} filterByCode={filterByCode} />}
      {seg === "bs" && <Balance m={m} />}
      {seg === "trends" && <Trends m={m} />}
      <h3>Books health</h3>
      <p className="sub">Last closed month: {s.lastClosedMonth || "none yet"}.</p>
      {s.closeBlockers.length === 0 ? <p className="sub">No close blockers.</p>
        : <ul className="list">{s.closeBlockers.map((b) => <li key={b} className="warn">{b}</li>)}</ul>}
    </section>
  );
}
