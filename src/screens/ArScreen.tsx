import { useLabel } from "../components/NamesContext.tsx";
import { invoiceStats, money, type ArItem } from "../lib/parse.ts";

// App Invoices is pre-masked (codes); names are substituted in memory only when names are on.
function Group({ title, items }: { title: string; items: ArItem[] }) {
  const label = useLabel();
  if (items.length === 0) return null;
  return (
    <>
      <h3>{title}</h3>
      <ul className="list">
        {items.map((i) => (
          <li key={i.number} className="row">
            <div>
              <strong>{label(i.code)}</strong>
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

// `previewed`: invoice numbers already shown with an email preview above (Invoices screen); other drafts stay listed here.
export function ArScreen({ items, today, previewed }: { items: ArItem[]; today: string; previewed?: ReadonlySet<string> }) {
  const hideDrafts = previewed !== undefined;
  const st = invoiceStats(items, today);
  const drafts = st.drafts.filter((i) => !previewed?.has(i.number));
  const overdueNums = new Set(st.overdue.map((i) => i.number));
  return (
    <section>
      {hideDrafts ? <h3>Unpaid <span className="muted">{money(st.outstandingTotal)}</span></h3> : <h2>Unpaid invoices <span className="muted">{money(st.outstandingTotal)}</span></h2>}
      {items.length === 0 && <p className="muted">No invoices published yet.</p>}
      <Group title="Overdue" items={st.overdue} />
      <Group title="Outstanding" items={st.outstanding.filter((i) => !overdueNums.has(i.number))} />
      {drafts.length > 0 && hideDrafts && <p className="sub">These drafts have no email preview yet. Previews, and the Approve button, appear once the invoice script is running.</p>}
      <Group title={hideDrafts ? "Drafts (no preview yet)" : "Ready to send (drafts)"} items={drafts} />
      <Group title="Paid, last 30 days" items={st.paid30} />
    </section>
  );
}
