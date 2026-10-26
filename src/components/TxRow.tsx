import { isPending, money, type Decision, type Tx } from "../lib/parse.ts";
import { useLabel } from "./NamesContext.tsx";

// Categories show by name only; account codes stay behind the scenes.
export function TxRow({ tx, latest, names, onOpen }: { tx: Tx; latest: Map<string, Decision>; names: Map<string, string>; onOpen: (t: Tx) => void }) {
  const label = useLabel();
  const pend = isPending(tx, latest);
  const newCode = latest.get(tx.entry)?.account ?? "";
  const chip = pend ? `pending: ${names.get(newCode) ?? "new category"}` : tx.code ? tx.category : "Needs booking";
  return (
    <li>
      <button className="txrow" onClick={() => onOpen(tx)}>
        <div className="grow">
          <div className="desc">{label(tx.description) || "(no description)"}</div>
          <div className="sub">{tx.date} - {tx.account}{tx.locked ? " - closed" : ""}</div>
          <span className={"chip" + (pend ? " pend" : tx.code ? "" : " review")}>{chip}</span>
        </div>
        <div className={"amt" + (tx.amount > 0 ? " pos" : "")}>{money(tx.amount)}</div>
      </button>
    </li>
  );
}
