import { money, txChip, type Decision, type Tx } from "../lib/parse.ts";
import { useLabel } from "./NamesContext.tsx";

// Categories show by name only; account codes stay behind the scenes. A deposit shows the invoice(s) it paid
// ("Applied to") as a sub-line; an ignored line is muted with its reason.
export function TxRow({ tx, latest, names, onOpen }: { tx: Tx; latest: Map<string, Decision>; names: Map<string, string>; onOpen: (t: Tx) => void }) {
  const label = useLabel();
  const chip = txChip(tx, latest, names);
  const ignored = chip.kind === "ignored";
  return (
    <li>
      <button className={"txrow" + (ignored ? " ignored" : "")} onClick={() => onOpen(tx)}>
        <div className="grow">
          <div className="desc">{label(tx.description) || "(no description)"}</div>
          <div className="sub">{tx.date} - {tx.account}{tx.locked ? " - closed" : ""}</div>
          {tx.appliedTo && <div className="sub applied">{label(tx.appliedTo)}</div>}
          <span className={"chip" + (chip.kind === "pend" ? " pend" : chip.kind === "review" || chip.kind === "rejected" ? " review" : "")}>{chip.text}</span>
        </div>
        <div className={"amt" + (tx.amount > 0 && !ignored ? " pos" : "")}>{money(tx.amount)}</div>
      </button>
    </li>
  );
}
