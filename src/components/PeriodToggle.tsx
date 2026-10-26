import { PERIODS, PERIOD_LABEL, type Period } from "../lib/parse.ts";

export function PeriodToggle({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="seg small" role="group" aria-label="Time period">
      {PERIODS.map((p) => (
        <button key={p} className={value === p ? "on" : ""} onClick={() => onChange(p)} title={PERIOD_LABEL[p]} aria-pressed={value === p}>{p}</button>
      ))}
    </div>
  );
}
