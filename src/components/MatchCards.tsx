import { useState } from "react";
import {
  approveQuestion, invoiceWords, matchAnswer, matchCardState, money, proposedMatches, RAIL_LABEL, REJECT_QUESTION,
  type Decision, type Match, type MatchChoice,
} from "../lib/parse.ts";
import { ConfirmSheet } from "./ConfirmSheet.tsx";
import { useLabel } from "./NamesContext.tsx";

export type MatchAnswers = ReadonlyMap<string, MatchChoice>; // this session only, by Match id

interface Props {
  matches: Match[] | null; // null: App Matches not published (or could not load): nothing is shown
  answers: MatchAnswers;
  latest: ReadonlyMap<string, Decision>; // App Decisions, so an answer given earlier still shows as answered
  onAnswer: (m: Match, choice: MatchChoice) => Promise<void>;
}

function MatchCard({ m, answer, onAnswer }: { m: Match; answer: MatchChoice | undefined; onAnswer: Props["onAnswer"] }) {
  const label = useLabel();
  const [ask, setAsk] = useState<MatchChoice | null>(null);
  const state = matchCardState(answer);
  const who = m.code ? `${label(m.code)}: ` : "";
  const nums = m.invoices.length > 1 ? invoiceWords(m.invoices) : `Invoice ${m.invoices[0]}`;
  const showAlts = m.confidence !== "high" && m.alternatives.length > 0;
  return (
    <li className="card matchcard">
      <div className="row">
        <div className="grow">
          <strong>{money(m.amount)}</strong> <span className="sub">{RAIL_LABEL[m.rail]}, deposited {m.date}</span>
          <div>{who}{nums[0].toUpperCase() + nums.slice(1)}{m.invoiceTotal !== null ? ` (${money(m.invoiceTotal)})` : ""}</div>
        </div>
        <span className={"conf " + m.confidence}>{m.confidence}</span>
      </div>
      {m.why && <div className="sub">{m.why}</div>}
      {m.variance && <div className="sub warn">Variance {m.variance}</div>}
      {showAlts && (
        <div className="sub could">Could also be:
          {m.alternatives.map((a, i) => <div key={i}>{label(a.code)}: {invoiceWords(a.invoices)}</div>)}
        </div>
      )}
      {state.answered ? (
        <p className="ok">{state.message}</p>
      ) : (
        <div className="btnrow">
          <button className="btn big" disabled={state.buttonsDisabled} onClick={() => setAsk("APPROVE")}>Approve</button>
          <button className="btn alt" disabled={state.buttonsDisabled} onClick={() => setAsk("REJECT")}>Not this one</button>
        </div>
      )}
      {ask && (
        <ConfirmSheet title={m.code ? label(m.code) : "Deposit match"} confirmLabel="Confirm" onConfirm={() => onAnswer(m, ask)} onClose={() => setAsk(null)}>
          <p><strong>{ask === "APPROVE" ? approveQuestion(m) : REJECT_QUESTION}</strong></p>
        </ConfirmSheet>
      )}
    </li>
  );
}

// "Awaiting your OK": proposed deposit matches, at the top of Invoices. Shown only when there are some.
export function AwaitingOk({ matches, answers, latest, onAnswer }: Props) {
  const list = proposedMatches(matches ?? []);
  if (list.length === 0) return null;
  const waiting = list.filter((m) => !matchAnswer(m.id, answers, latest)).length;
  return (
    <>
      <h3>Awaiting your OK <span className="muted">{waiting}</span></h3>
      <ul className="list">
        {list.map((m) => <MatchCard key={m.id} m={m} answer={matchAnswer(m.id, answers, latest)} onAnswer={onAnswer} />)}
      </ul>
    </>
  );
}
