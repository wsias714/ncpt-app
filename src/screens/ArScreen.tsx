import { money, totalOpen, type ArItem } from "../lib/parse.ts";

// Codes only. Customer names are never read from the Sheet.
export function ArScreen({ items }: { items: ArItem[] }) {
  return (
    <section>
      <h2>Unpaid invoices <span className="muted">{money(totalOpen(items))}</span></h2>
      {items.length === 0 && <p className="muted">No open invoices.</p>}
      <ul className="list">
        {items.map((i) => (
          <li key={i.number} className="row">
            <div>
              <strong>{i.code}</strong>
              <div className="sub">Invoice {i.number} - {i.status}</div>
            </div>
            <div className="right">
              <div>{money(i.amount)}</div>
              <div className={"sub" + ((i.ageDays ?? 0) > 60 ? " warn" : "")}>{i.ageDays === null ? "age n/a" : `${i.ageDays} days`}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
