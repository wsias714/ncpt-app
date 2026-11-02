import { PERIODS, PERIOD_LABEL, type Period, type TrendRange } from "../lib/parse.ts";

const LABEL: Record<string, string> = { ...PERIOD_LABEL, ALL: "Every full month published" };

// Generic over the option list so Trends can add All without changing the other screens.
export function PeriodToggle<T extends string = Period>({ value, onChange, options }: { value: T; onChange: (p: T) => void; options?: readonly T[] }) {
  const list = (options ?? (PERIODS as readonly string[] as readonly T[]));
  return (
    <div className="seg small" role="group" aria-label="Time period">
      {list.map((p) => (
        <button key={p} className={value === p ? "on" : ""} onClick={() => onChange(p)} title={LABEL[p]} aria-pressed={value === p}>{p === "ALL" ? "All" : p}</button>
      ))}
    </div>
  );
}

export type { TrendRange };
