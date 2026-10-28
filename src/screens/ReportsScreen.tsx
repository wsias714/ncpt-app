import { useState } from "react";
import { BarChart, LineChart } from "../components/Chart.tsx";
import { PeriodToggle } from "../components/PeriodToggle.tsx";
import { HISTORY_YEARS, type Model } from "../lib/model.ts";
import {
  beforeOwnerPay, compareYears, money, monthlyYears, ownerPayInMonths, PERIOD_LABEL, TREND_RANGES, trendMonths,
  type Period, type TrendRange,
} from "../lib/parse.ts";

type Seg = "is" | "bs" | "trends" | "yoy";
interface Props { m: Model; filterByCode: (code: string) => void }

const currentYear = (m: Model) => m.summary.asOf.slice(0, 4) || m.today.slice(0, 4);
// The current year first, then the past years that were published.
const statementYears = (m: Model, have: (y: string) => boolean) => [currentYear(m), ...HISTORY_YEARS.filter((y) => y !== currentYear(m) && have(y))];

function YearSelect({ years, value, onChange }: { years: string[]; value: string; onChange: (y: string) => void }) {
  if (years.length < 2) return null;
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Year">
      {years.map((y) => <option key={y} value={y}>{y}</option>)}
    </select>
  );
}

function Statement({ m, filterByCode }: Props) {
  const cur = currentYear(m);
  const [year, setYear] = useState(cur);
  const [basis, setBasis] = useState<"cash" | "accrual">("cash");
  const [period, setPeriod] = useState<Period>("YTD");
  const [pick, setPick] = useState<string>(""); // a single month index, or "" to use the period
  const past = year !== cur;
  const p = past ? m.pnlHistory[year] ?? m.pnl : m.pnl;
  if (p.sections.length === 0) return <p className="muted">The income statement has not been published yet.</p>;
  const L = p.months.length;
  // Columns summed: single months for 1M/3M/6M or a picked month, else the year-to-date column.
  const accrual = basis === "accrual";
  const ytdCol = L + (accrual ? 1 : 0);
  const n = Math.min(Number(period[0]), L);
  const monthCols = accrual ? [] : pick !== "" ? [Math.min(Number(pick), L - 1)] : period === "YTD" ? [] : Array.from({ length: n }, (_, i) => L - n + i);
  const cols = monthCols.length ? monthCols : [ytdCol];
  const at = (v: number[]) => cols.reduce((a, c) => a + (v[c] ?? 0), 0);
  const ownerPay = ownerPayInMonths(m.monthly, year, monthCols.length ? monthCols.map((c) => c + 1) : undefined);
  const whole = past ? `Full year ${year}` : "Year to date";
  const title = accrual ? whole : pick !== "" ? `${p.months[Number(pick)]} ${year}` : period === "YTD" ? whole
    : past ? (period === "1M" ? `${p.months[L - 1]} ${year}` : `Last ${n} months of ${year}`) : PERIOD_LABEL[period];
  const years = statementYears(m, (y) => !!m.pnlHistory[y]);
  return (
    <>
      <div className="filters">
        <YearSelect years={years} value={year} onChange={(y) => { setYear(y); setPick(""); }} />
        <PeriodToggle value={period} onChange={(x) => { setPeriod(x); setPick(""); }} />
        <select value={pick} onChange={(e) => setPick(e.target.value)} disabled={accrual} aria-label="Single month">
          <option value="">Pick a month</option>
          {p.months.map((mo, i) => <option key={mo + i} value={String(i)}>{mo}</option>)}
        </select>
        <div className="seg small" role="group" aria-label="Basis">
          <button className={basis === "cash" ? "on" : ""} onClick={() => setBasis("cash")}>Cash</button>
          <button className={basis === "accrual" ? "on" : ""} onClick={() => setBasis("accrual")}>Accrual</button>
        </div>
      </div>
      {accrual && <p className="sub">Accrual is available for the {past ? "full year" : "year to date"} only.</p>}
      <p className="sub">{title}</p>
      {p.sections.map((s) => (
        <div key={s.title}>
          <h3>{s.title}</h3>
          <ul className="list">
            {s.rows.filter((r) => at(r.values) !== 0).map((r) => (
              <li key={r.code}>
                <button className="txrow" onClick={() => filterByCode(r.code)}>
                  <span className="grow">{r.name}</span><span>{money(at(r.values))}</span>
                </button>
              </li>
            ))}
            <li className="row total"><strong>Total {s.title.toLowerCase()}</strong><strong>{money(at(s.total))}</strong></li>
          </ul>
        </div>
      ))}
      <div className="row total big2"><strong>Net income ({basis})</strong><strong className={at(p.net) < 0 ? "warn" : ""}>{money(at(p.net))}</strong></div>
      <div className="row sub"><span>Owner pay added back (net wages + 401k)</span><span>{money(ownerPay)}</span></div>
      <div className="row total big2"><strong>Net income before owner pay</strong><strong>{money(beforeOwnerPay(at(p.net), ownerPay))}</strong></div>
      <p className="sub">Tap an account to see its transactions.{past ? " Years before 2026 come from Wave's books." : ""}</p>
    </>
  );
}

function Balance({ m }: { m: Model }) {
  const cur = currentYear(m);
  const [year, setYear] = useState(cur);
  const [idx, setIdx] = useState(-1);
  const b = year !== cur ? m.bsHistory[year] ?? m.bs : m.bs;
  const years = statementYears(m, (y) => !!m.bsHistory[y]);
  if (b.sections.length === 0) return <p className="muted">The balance sheet has not been published yet.</p>;
  const i = idx < 0 ? b.ends.length - 1 : Math.min(idx, b.ends.length - 1);
  return (
    <>
      <div className="filters">
        <YearSelect years={years} value={year} onChange={(y) => { setYear(y); setIdx(-1); }} />
        <select value={i} onChange={(e) => setIdx(Number(e.target.value))} aria-label="As of month end">
          {b.ends.map((e, k) => <option key={e + k} value={k}>As of {e}</option>)}
        </select>
      </div>
      {b.sections.map((s) => (
        <div key={s.title}>
          <h3>{s.title}</h3>
          <ul className="list">
            {s.rows.filter((r) => r.values[i] !== 0).map((r) => (
              <li key={r.code + r.name} className="row"><span>{r.name}</span><span>{money(r.values[i])}</span></li>
            ))}
            <li className="row total"><strong>Total {s.title.toLowerCase()}</strong><strong>{money(s.total[i] ?? 0)}</strong></li>
          </ul>
        </div>
      ))}
    </>
  );
}

function Trends({ m }: { m: Model }) {
  const [range, setRange] = useState<TrendRange>("12M");
  if (m.monthly.length === 0) return <p className="muted">Monthly history has not been published yet.</p>;
  const asOf = m.summary.asOf || m.today;
  const picked = trendMonths(m.monthly, asOf, range);
  const rows = picked.length >= 2 ? picked : m.monthly.filter((r) => r.month <= asOf.slice(0, 7)).slice(-2); // a chart needs two months
  const labels = rows.map((r) => r.month);
  return (
    <>
      <PeriodToggle value={range} onChange={setRange} options={TREND_RANGES} />
      <BarChart title="Income and expense by month" labels={labels} series={[
        { name: "Income", color: "var(--accent)", values: rows.map((r) => r.income) },
        { name: "Expense", color: "var(--warn)", values: rows.map((r) => r.expense) },
      ]} />
      <BarChart title="Net profit by month (cash)" labels={labels} series={[
        { name: "Net cash", color: "var(--accent)", values: rows.map((r) => r.netCash) },
      ]} />
      <BarChart title="Net profit before owner pay by month (cash)" labels={labels} series={[
        { name: "Before owner pay", color: "var(--accent)", values: rows.map((r) => beforeOwnerPay(r.netCash, r.netWages + r.k401) ?? 0) },
      ]} />
      <LineChart title="Cash and receivables at month end" labels={labels} series={[
        { name: "Cash", color: "var(--accent)", values: rows.map((r) => r.cashEnd) },
        { name: "Receivable", color: "var(--warn)", values: rows.map((r) => r.arEnd) },
      ]} />
    </>
  );
}

function YearOverYear({ m }: { m: Model }) {
  const cur = currentYear(m);
  const all = monthlyYears(m.monthly);
  const years = all.slice(0, -1); // the oldest year has nothing to compare against
  const [picked, setPicked] = useState(years.includes(cur) ? cur : years[0] ?? cur);
  const [period, setPeriod] = useState<Period>("YTD");
  const y = picked;
  const c = compareYears(m.monthly, y === cur ? m.summary.asOf || m.today : `${y}-12-31`, period);
  const prior = String(Number(y) - 1);
  const lines: [string, number, number][] = [
    ["Income", c.current.income, c.prior.income],
    ["Expenses", c.current.expense, c.prior.expense],
    ["Net profit (cash)", c.current.net, c.prior.net],
    ["Owner pay (net wages + 401k)", c.current.ownerPay, c.prior.ownerPay],
    ["Profit before owner pay", c.current.beforeOwnerPay, c.prior.beforeOwnerPay],
  ];
  return (
    <>
      <div className="filters">
        <YearSelect years={years} value={y} onChange={setPicked} />
        <PeriodToggle value={period} onChange={setPeriod} />
      </div>
      <p className="sub">{c.currentLabel} against {c.priorLabel}.</p>
      {c.priorMonths === 0 ? (
        <p className="muted">No {prior} data for these months.</p>
      ) : (
        <>
          {c.priorMonths < c.current.months && <p className="sub">Only {c.priorMonths} of {c.current.months} {prior} months have data.</p>}
          <ul className="list">
            <li className="yoyhead"><strong>&nbsp;</strong><strong>{y}</strong><strong>{prior}</strong><strong>Change</strong></li>
            {lines.map(([name, a, b]) => (
              <li key={name} className="yoy"><span className="grow">{name}</span><span>{money(a)}</span><span>{money(b)}</span>
                <span className={a - b < 0 ? "warn" : "pos"}>{money(Math.round((a - b) * 100) / 100)}</span></li>
            ))}
          </ul>
          <p className="sub">2024 and 2025 come from Wave's books, checked against the filed returns.</p>
        </>
      )}
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
        <button className={seg === "yoy" ? "on" : ""} onClick={() => setSeg("yoy")}>Year over year</button>
      </div>
      {seg === "is" && <Statement m={m} filterByCode={filterByCode} />}
      {seg === "bs" && <Balance m={m} />}
      {seg === "trends" && <Trends m={m} />}
      {seg === "yoy" && <YearOverYear m={m} />}
      <h3>Books health</h3>
      <p className="sub">Last closed month: {s.lastClosedMonth || "none yet"}.</p>
      {s.closeBlockers.length === 0 ? <p className="sub">No close blockers.</p>
        : <ul className="list">{s.closeBlockers.map((b) => <li key={b} className="warn">{b}</li>)}</ul>}
    </section>
  );
}
