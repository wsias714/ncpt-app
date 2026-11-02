// Hand-rolled SVG charts (no chart library). Colors come from CSS variables so light/dark work.
import { useState } from "react";
import { money, type ProfitPoint } from "../lib/parse.ts";

export interface Series { name: string; color: string; values: number[] }

const W = 320, H = 140, PAD = { l: 4, r: 4, t: 8, b: 18 };

function extent(all: number[]): [number, number] {
  const lo = Math.min(0, ...all), hi = Math.max(0, ...all);
  return hi === lo ? [lo, lo + 1] : [lo, hi];
}

function Frame({ labels, children, legend, title, lo, hi, fmt = money }: {
  labels: string[]; children: React.ReactNode; legend: Series[]; title: string; lo: number; hi: number; fmt?: (n: number) => string;
}) {
  const every = Math.ceil(labels.length / 6);
  const step = (W - PAD.l - PAD.r) / Math.max(1, labels.length);
  return (
    <figure className="figure">
      <figcaption>{title}</figcaption>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}, ${labels[0] ?? ""} to ${labels[labels.length - 1] ?? ""}`}>
        {children}
        {labels.map((l, i) => i % every === 0 && (
          <text key={l + i} x={PAD.l + step * (i + 0.5)} y={H - 4} textAnchor="middle" className="tick">{labels.length > 12 ? l.slice(2) : l.slice(5) || l}</text>
        ))}
      </svg>
      <div className="legend">
        {legend.map((s) => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}
        <span className="muted">range {fmt(lo)} to {fmt(hi)}</span>
      </div>
    </figure>
  );
}

export function BarChart({ title, labels, series, fmt }: { title: string; labels: string[]; series: Series[]; fmt?: (n: number) => string }) {
  if (!labels.length) return null;
  const [lo, hi] = extent(series.flatMap((s) => s.values));
  const plotH = H - PAD.t - PAD.b;
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * plotH;
  const step = (W - PAD.l - PAD.r) / labels.length;
  const bw = (step * 0.8) / series.length;
  return (
    <Frame labels={labels} legend={series} title={title} lo={lo} hi={hi} fmt={fmt}>
      <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} className="axis" />
      {labels.map((_, i) => series.map((s, k) => {
        const v = s.values[i] ?? 0;
        const top = Math.min(y(v), y(0));
        return <rect key={`${i}-${k}`} x={PAD.l + step * i + step * 0.1 + bw * k} y={top} width={Math.max(1, bw - 1)} height={Math.max(1, Math.abs(y(v) - y(0)))} fill={s.color} rx="1" />;
      }))}
    </Frame>
  );
}

export function LineChart({ title, labels, series, fmt }: { title: string; labels: string[]; series: Series[]; fmt?: (n: number) => string }) {
  if (labels.length < 2) return null;
  const [lo, hi] = extent(series.flatMap((s) => s.values));
  const plotH = H - PAD.t - PAD.b;
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * plotH;
  const step = (W - PAD.l - PAD.r) / labels.length;
  const x = (i: number) => PAD.l + step * (i + 0.5);
  return (
    <Frame labels={labels} legend={series} title={title} lo={lo} hi={hi} fmt={fmt}>
      <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} className="axis" />
      {series.map((s) => (
        <polyline key={s.name} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round"
          points={s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")} />
      ))}
    </Frame>
  );
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (n: number): string => {
  const a = Math.abs(n), sign = n < 0 ? "-" : "";
  return a >= 1000 ? `${sign}$${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k` : `${sign}$${Math.round(a)}`;
};

// Today's profit chart: two lines per month, with a zero line. The open month (if any) is the dashed last segment and
// a hollow marker, labelled "so far". Tap or hover a month to read both values.
export function ProfitChart({ points, title }: { points: ProfitPoint[]; title: string }) {
  const [sel, setSel] = useState<number | null>(null);
  if (points.length < 2) return <p className="sub">Not enough months to chart yet.</p>;
  const CW = 320, CH = 170, P = { l: 30, r: 34, t: 14, b: 22 };
  const all = points.flatMap((p) => [p.before, p.after]);
  const lo0 = Math.min(0, ...all), hi0 = Math.max(0, ...all);
  const pad = (hi0 - lo0 || 1) * 0.08;
  const lo = lo0 < 0 ? lo0 - pad : 0, hi = hi0 + pad;
  const y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (CH - P.t - P.b);
  const x = (i: number) => P.l + (i / (points.length - 1)) * (CW - P.l - P.r);
  const lines = [
    { key: "before" as const, name: "Profit before owner pay", color: "var(--accent)" },
    { key: "after" as const, name: "Profit after owner pay", color: "var(--amber)" },
  ];
  const lastIdx = points.length - 1;
  const hasOpen = points[lastIdx].open;
  const solidEnd = hasOpen ? lastIdx - 1 : lastIdx; // index of the last complete month
  const pts = (key: "before" | "after", from: number, to: number) =>
    points.slice(from, to + 1).map((p, k) => `${x(from + k).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  const every = Math.ceil(points.length / 7);
  const mlabel = (p: ProfitPoint) => MONTH_SHORT[Number(p.month.slice(5, 7)) - 1] ?? p.month;
  const shown = sel === null ? null : points[sel];
  // Label the two end values; the higher line's label sits above its dot and the lower line's below, so they never overlap.
  const endLabel = (i: number, anchor: "start" | "end") => lines.map((l) => {
    const above = l.key === "before" ? points[i].before >= points[i].after : points[i].after > points[i].before;
    return <text key={`${l.key}${i}`} x={x(i) + (anchor === "start" ? -2 : 2)} y={y(points[i][l.key]) + (above ? -6 : 12)} textAnchor="start" className="vlabel" fill={l.color}>{short(points[i][l.key])}</text>;
  });
  return (
    <figure className="figure profit">
      <svg className="chart" viewBox={`0 0 ${CW} ${CH}`} role="img"
        aria-label={`${title}: ${points.map((p) => `${p.month} before ${money(p.before)} after ${money(p.after)}${p.open ? " so far" : ""}`).join("; ")}`}
        onMouseLeave={() => setSel(null)}>
        <line x1={P.l} x2={CW - P.r} y1={y(0)} y2={y(0)} className="axis zero" />
        <text x={P.l - 4} y={y(0) + 3} textAnchor="end" className="tick">$0</text>
        {shown && <line x1={x(sel!)} x2={x(sel!)} y1={P.t} y2={CH - P.b} className="axis" strokeDasharray="2 2" />}
        {lines.map((l) => (
          <g key={l.key}>
            {solidEnd >= 1 && <polyline points={pts(l.key, 0, solidEnd)} fill="none" stroke={l.color} strokeWidth="2" strokeLinejoin="round" />}
            {hasOpen && solidEnd >= 0 && <polyline points={pts(l.key, solidEnd, lastIdx)} fill="none" stroke={l.color} strokeWidth="2" strokeDasharray="4 3" />}
            {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p[l.key])} r={p.open ? 3.5 : 2.5} fill={p.open ? "var(--card)" : l.color} stroke={l.color} strokeWidth="1.5" />)}
          </g>
        ))}
        {endLabel(0, "start")}
        {endLabel(lastIdx, "start")}
        {points.map((p, i) => (i % every === 0 || i === lastIdx) && (
          <text key={p.month} x={x(i)} y={CH - 6} textAnchor={i === 0 ? "start" : i === lastIdx ? "end" : "middle"} className="tick">{mlabel(p)}{p.open ? " so far" : ""}</text>
        ))}
        {points.map((p, i) => (
          <rect key={"hit" + p.month} x={x(i) - (CW - P.l - P.r) / (points.length - 1) / 2} y={0} width={(CW - P.l - P.r) / (points.length - 1)} height={CH}
            fill="transparent" onMouseEnter={() => setSel(i)} onClick={() => setSel(sel === i ? null : i)} />
        ))}
      </svg>
      <div className="legend">
        {lines.map((l) => <span key={l.key}><i style={{ background: l.color }} />{l.name}</span>)}
      </div>
      <div className="sub readout" aria-live="polite">
        {shown
          ? <>{MONTH_SHORT[Number(shown.month.slice(5, 7)) - 1]} {shown.month.slice(0, 4)}{shown.open ? " (so far)" : ""}: before owner pay {money(shown.before)}, after owner pay {money(shown.after)}</>
          : <span className="muted">Tap a month to see both values.{hasOpen ? " Dashed: this month so far." : ""}</span>}
      </div>
    </figure>
  );
}
