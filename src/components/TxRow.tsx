import { isPending, money, type Decision, type Tx } from "../lib/parse.ts";

export function TxRow({ tx, latest, onOpen }: { tx: Tx; latest: Map<string, Decision>; onOpen: (t: Tx) => void }) {
  const pend = isPending(tx, latest);
  const chip = pend ? `pending ${latest.get(tx.entry)?.account}` : tx.code ? `${tx.code} ${tx.category}` : "Needs booking";
  return (
    <li>
      <button className="txrow" onClick={() => onOpen(tx)}>
        <div className="grow">
          <div className="desc">{tx.description || "(no description)"}</div>
          <div className="sub">{tx.date} - {tx.account}{tx.locked ? " - closed" : ""}</div>
          <span className={"chip" + (pend ? " pend" : tx.code ? "" : " review")}>{chip}</span>
        </div>
        <div className={"amt" + (tx.amount > 0 ? " pos" : "")}>{money(tx.amount)}</div>
      </button>
    </li>
  );
}
