import { useState } from "react";
import { Sparkline } from "../components/Chart.tsx";
import { PeriodToggle } from "../components/PeriodToggle.tsx";
import { TxRow } from "../components/TxRow.tsx";
import type { Model } from "../lib/model.ts";
import { invoiceStats, money, needsBooking, periodMonths, PERIOD_LABEL, recentTransactions, totals, wagesTotal, type Period, type Tx } from "../lib/parse.ts";

interface Props { m: Model; openTx: (t: Tx) => void; goUnpaid: () => void; goTransactions: (reviewOnly: boolean) => void; goReports: () => void }

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className={"value" + (warn ? " warn" : "")}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function TodayScreen({ m, openTx, goUnpaid, goTransactions, goReports }: Props) {
  const s = m.summary;
  const [period, setPeriod] = useState<Period>("1M");
  const t = totals(periodMonths(m.monthly, s.asOf || m.today, period));
  const inv = invoiceStats(m.invoices, m.today);
  const wages = wagesTotal(s);
  const need = m.txs.filter((t) => needsBooking(t, m.latest));
  const recent = recentTransactions(m.txs, m.today);
  const spark = m.monthly.slice(-12).map((r) => r.netCash);
  const needCount = s.needsBooking ?? need.length;

  if (!s.present && m.txs.length === 0 && m.invoices.length === 0) {
    return (
      <section>
        <h2>Today</h2>
        <p className="muted">The books have not been published to the app yet. Check back after the next publish.</p>
      </section>
    );
  }

  return (
    <section>
      <h2>Today <span className="muted">as of {s.asOf || "?"}</span></h2>

      <div className="card hero">
        <div className="row"><div className="label">Profit, {PERIOD_LABEL[period].toLowerCase()} (cash basis)</div><PeriodToggle value={period} onChange={setPeriod} /></div>
        <div className={"big" + (t.net < 0 ? " warn" : "")}>{money(t.net)}</div>
        <Sparkline values={spark} label="Monthly cash profit, last 12 months" />
        <div className="before">
          <div className="label">Before owner pay <span className="muted">(net wages and 401k are owner income)</span></div>
          <div className="big small">{money(t.beforeOwnerPay)}</div>
          <div className="row sub"><span>Net wages {money(t.netWages)}</span><span>401k {money(t.k401)}</span></div>
        </div>
      </div>

      <div className="card">
        <h3>Wages paid, year to date</h3>
        <div className="big small">{money(wages)}</div>
        <div className="sub">Gross {money(s.wagesGrossYtd)} - employer taxes {money(s.payrollTaxesYtd)} - 401k match {money(s.matchYtd)}</div>
        <div className="sub">Owner pay: net wages {money(s.netWagesYtd)} + 401k {money(s.k401Ytd)}</div>
        <div className="sub">Payroll still owed: {money(s.payrollLiab)}</div>
      </div>

      <div className="card">
        <h3>Invoices</h3>
        <div className="grid3">
          <button className="stat tap" onClick={goUnpaid}>
            <div className="label">Outstanding</div>
            <div className="value">{money(inv.outstandingTotal)}</div>
            <div className="sub">{inv.outstanding.length} open{inv.oldestAgeDays !== null ? `, oldest ${inv.oldestAgeDays}d` : ""}</div>
            {inv.overdue.length > 0 && <div className="sub warn">{inv.overdue.length} overdue</div>}
          </button>
          <button className="stat tap" onClick={goUnpaid}>
            <div className="label">Ready to send</div>
            <div className="value">{inv.drafts.length}</div>
            <div className="sub">{money(inv.draftsTotal)} in drafts</div>
          </button>
          <button className="stat tap" onClick={goUnpaid}>
            <div className="label">Paid, last 30 days</div>
            <div className="value">{money(inv.paid30Total)}</div>
            <div className="sub">{inv.paid30.length} invoices</div>
          </button>
        </div>
      </div>

      <div className="card">
        <div className="row"><h3>Needs booking <span className="muted">{needCount}</span></h3>
          {needCount > 0 && <button className="link" onClick={() => goTransactions(true)}>See all</button>}</div>
        {need.length === 0 ? <p className="muted">Nothing waiting.</p> : (
          <ul className="list">{need.slice(0, 5).map((t) => <TxRow key={t.entry} tx={t} latest={m.latest} names={m.accountNames} onOpen={openTx} />)}</ul>
        )}
      </div>

      <div className="card">
        <h3>Last 7 days</h3>
        {recent.length === 0 ? <p className="muted">No activity.</p> : (
          <ul className="list">{recent.map((t) => <TxRow key={t.entry} tx={t} latest={m.latest} names={m.accountNames} onOpen={openTx} />)}</ul>
        )}
      </div>

      <div className="strip">
        <Stat label="Cash" value={money(s.cash)} />
        <Stat label="Card owed" value={money(s.cardOwed)} />
        <Stat label="Receivable" value={money(s.ar)} />
        <Stat label="Mileage owed" value={money(s.mileageOwed)} sub={s.mileageDue ? `pay by ${s.mileageDue}` : undefined} />
      </div>

      <div className="health sub">
        <button className="link" onClick={goReports}>Books health</button>
        Last closed month: {s.lastClosedMonth || "none yet"}.{" "}
        {s.closeBlockers.length === 0 ? "No close blockers." : <span className="warn">{s.closeBlockers.length} blocker(s): {s.closeBlockers.join("; ")}</span>}
      </div>
    </section>
  );
}
