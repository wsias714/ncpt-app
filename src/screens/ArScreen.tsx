import { useState } from "react";
import { ConfirmSheet } from "../components/ConfirmSheet.tsx";
import { useLabel } from "../components/NamesContext.tsx";
import type { MarkAction } from "../lib/outbox.ts";
import { money, type ArItem, type InvoiceStats } from "../lib/parse.ts";
import { md } from "../lib/upcoming.ts";

// App Invoices sections of the Invoices screen. The tab is pre-masked (codes); names are substituted in memory only
// when names are on, so all of these work with names off.

const MARK: Record<MarkAction, { button: string; confirm: string; title: (n: string, amt: string) => string; help: string; done: string; danger?: boolean }> = {
  MARK_SENT: {
    button: "Mark sent", confirm: "Mark sent", title: (n, a) => `Mark invoice ${n} (${a}) as sent?`,
    help: "Use this when it was delivered some other way than Approve and send. It then counts as owed.",
    done: "Marked sent",
  },
  MARK_ISSUED: {
    button: "Mark issued", confirm: "Mark issued", title: (n, a) => `Mark invoice ${n} (${a}) as issued?`,
    help: "Use this when you handed it over at the visit. It then counts as owed.",
    done: "Marked issued",
  },
  VOID: {
    button: "Void", confirm: "Void invoice", title: (n, a) => `Void invoice ${n} (${a})?`,
    help: "Only for an invoice that was never delivered. It stays on file as void and never counts as income. The app cannot undo this.",
    done: "Voided", danger: true,
  },
};

/** Drafts with no email: Mark sent / Mark issued / Void, each behind a confirm sheet. Hidden when empty. */
export function NeedsAttention({ items, marked, onMark }: {
  items: ArItem[]; marked: ReadonlyMap<string, MarkAction>; onMark: (i: ArItem, a: MarkAction) => Promise<void>;
}) {
  const label = useLabel();
  const [ask, setAsk] = useState<{ i: ArItem; a: MarkAction } | null>(null);
  if (items.length === 0) return null;
  return (
    <>
      <h3>Needs attention <span className="muted">{items.length}</span></h3>
      <p className="sub">Drafts with no email to approve. Say what happened to each one.</p>
      <ul className="list">
        {items.map((i) => {
          const done = marked.get(i.number);
          return (
            <li key={i.number} className="todo">
              <div className="row">
                <div className="grow">
                  <strong>{label(i.code)}</strong>
                  <div className="sub">Invoice {i.number}{i.invoiceDate ? ` - dated ${md(i.invoiceDate)}` : ""}</div>
                </div>
                <div className="right amt">{money(i.amount)}</div>
              </div>
              {done ? (
                <p className="ok small">{MARK[done].done}: requested. It moves in about a minute; tap Refresh.</p>
              ) : (
                <div className="todoact three">
                  {(Object.keys(MARK) as MarkAction[]).map((a) => (
                    <button key={a} className={"btn sm" + (a === "VOID" ? " alt" : "")} onClick={() => setAsk({ i, a })}>{MARK[a].button}</button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {ask && (
        <ConfirmSheet title={label(ask.i.code)} confirmLabel={MARK[ask.a].confirm} danger={MARK[ask.a].danger}
          onConfirm={() => onMark(ask.i, ask.a)} onClose={() => setAsk(null)}>
          <p><strong>{MARK[ask.a].title(ask.i.number, money(ask.i.amount))}</strong></p>
          <p className="sub">{MARK[ask.a].help}</p>
        </ConfirmSheet>
      )}
    </>
  );
}

/** Sent or issued, oldest first, with days outstanding. */
export function AwaitingPayment({ st, today }: { st: InvoiceStats; today: string }) {
  const label = useLabel();
  return (
    <>
      <h3>Awaiting payment <span className="muted">{money(st.outstandingTotal)}</span></h3>
      {st.outstanding.length === 0 && <p className="muted">Nothing owed.</p>}
      <ul className="list">
        {st.outstanding.map((i) => {
          const late = !!i.due && i.due < today;
          return (
            <li key={i.number} className="row">
              <div className="grow">
                <strong>{label(i.code)}</strong>
                <div className="sub">Invoice {i.number} - {i.status === "ISSUED" ? "issued" : "sent"}{i.invoiceDate ? ` ${md(i.invoiceDate)}` : ""}{i.due ? ` - due ${md(i.due)}` : ""}</div>
              </div>
              <div className="right">
                <div className="amt">{money(i.amount)}</div>
                <div className={"sub" + (late ? " warn" : "")}>{i.ageDays === null ? "age n/a" : `${i.ageDays} day${i.ageDays === 1 ? "" : "s"}`}{late ? ", overdue" : ""}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Paid in the last 30 days, with the paid date and the deposit(s) that paid it. */
export function RecentlyPaid({ st }: { st: InvoiceStats }) {
  const label = useLabel();
  if (st.paid30.length === 0) return null;
  return (
    <>
      <h3>Recently paid <span className="muted">{money(st.paid30Total)}</span></h3>
      <ul className="list">
        {st.paid30.map((i) => (
          <li key={i.number} className="row">
            <div className="grow">
              <strong>{label(i.code)}</strong>
              <div className="sub">Invoice {i.number}{i.paidOn ? ` - paid ${md(i.paidOn)}` : ""}</div>
              {i.deposit && <div className="sub">Deposit {i.deposit}</div>}
            </div>
            <div className="right amt">{money(i.amount)}</div>
          </li>
        ))}
      </ul>
    </>
  );
}
