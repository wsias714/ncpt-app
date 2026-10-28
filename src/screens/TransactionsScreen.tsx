import { useLabel } from "../components/NamesContext.tsx";
import { TxRow } from "../components/TxRow.tsx";
import type { Model } from "../lib/model.ts";
import { filterTransactions, money, txCategories, txMonths, type Tx, type TxFilter } from "../lib/parse.ts";

interface Props { m: Model; filter: TxFilter; setFilter: (f: TxFilter) => void; openTx: (t: Tx) => void }

const LIMIT = 200;

export function TransactionsScreen({ m, filter, setFilter, openTx }: Props) {
  const label = useLabel();
  const rows = filterTransactions(m.txs, filter, m.latest, label);
  const set = (p: Partial<TxFilter>) => setFilter({ ...filter, ...p });
  const cats = txCategories(m.txs);
  const active = filter.account || filter.month || filter.code || filter.reviewOnly || filter.query;
  return (
    <section>
      <h2>Transactions <span className="muted">{rows.length}</span></h2>
      <input className="search" type="search" placeholder="Search description, category, amount" value={filter.query}
        onChange={(e) => set({ query: e.target.value })} aria-label="Search transactions" />
      <div className="filters">
        <select value={filter.account} onChange={(e) => set({ account: e.target.value })} aria-label="Account">
          <option value="">All accounts</option><option value="Checking">Checking</option><option value="Card">Card</option>
        </select>
        <select value={filter.month} onChange={(e) => set({ month: e.target.value })} aria-label="Month">
          <option value="">All months</option>
          {txMonths(m.txs).map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <select value={filter.code} onChange={(e) => set({ code: e.target.value })} aria-label="Category">
          <option value="">All categories</option>
          {cats.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={filter.reviewOnly} onChange={(e) => set({ reviewOnly: e.target.checked })} /> Needs review</label>
        {active && <button className="link" onClick={() => setFilter({ query: "", account: "", month: "", reviewOnly: false, code: "" })}>Clear</button>}
      </div>
      {active && rows.length > 0 && <p className="sub">Total of these {rows.length}: {money(Math.round(rows.reduce((a, t) => a + t.amount, 0) * 100) / 100)}</p>}
      {m.txs.length === 0 && <p className="muted">No transactions published yet.</p>}
      {m.txs.length > 0 && rows.length === 0 && <p className="muted">Nothing matches.</p>}
      <ul className="list">{rows.slice(0, LIMIT).map((t) => <TxRow key={t.entry} tx={t} latest={m.latest} names={m.accountNames} onOpen={openTx} />)}</ul>
      {rows.length > LIMIT && <p className="muted">Showing the newest {LIMIT}. Narrow the filters to see more.</p>}
    </section>
  );
}
