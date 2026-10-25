import { invoiceStats, money, type ArItem } from "../lib/parse.ts";

// Codes only. Customer names never reach the browser (App Invoices is pre-masked).
function Group({ title, items }: { title: string; items: ArItem[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <h3>{title}</h3>
      <ul className="list">
        {items.map((i) => (
          <li key={i.number} className="row">
            <div>
              <strong>{i.code}</strong>
              <div className="sub">Invoice {i.number} - {i.status}{i.due ? ` - due ${i.due}` : ""}</div>
            </div>
            <div className="right">
              <div>{money(i.amount)}</div>
              <div className="sub">{i.ageDays === null ? "age n/a" : `${i.ageDays} days`}</div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export function ArScreen({ items, today }: { items: ArItem[]; today: string }) {
  const st = invoiceStats(items, today);
  const overdueNums = new Set(st.overdue.map((i) => i.number));
  return (
    <section>
      <h2>Unpaid invoices <span className="muted">{money(st.outstandingTotal)}</span></h2>
      {items.length === 0 && <p className="muted">No invoices published yet.</p>}
      <Group title="Overdue" items={st.overdue} />
      <Group title="Outstanding" items={st.outstanding.filter((i) => !overdueNums.has(i.number))} />
      <Group title="Ready to send (drafts)" items={st.drafts} />
      <Group title="Paid, last 30 days" items={st.paid30} />
    </section>
  );
}
