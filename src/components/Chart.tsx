// Hand-rolled SVG charts (no chart library). Colors come from CSS variables so light/dark work.
import { money } from "../lib/parse.ts";

export interface Series { name: string; color: string; values: number[] }

const W = 320, H = 140, PAD = { l: 4, r: 4, t: 8, b: 18 };

function extent(all: number[]): [number, number] {
  const lo = Math.min(0, ...all), hi = Math.max(0, ...all);
  return hi === lo ? [lo, lo + 1] : [lo, hi];
}

export function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return null;
  const [lo, hi] = extent(values);
  const x = (i: number) => (i / (values.length - 1)) * (W - 8) + 4;
  const y = (v: number) => 4 + (1 - (v - lo) / (hi - lo)) * 36;
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg className="chart spark" viewBox={`0 0 ${W} 44`} role="img" aria-label={label} preserveAspectRatio="none">
      <line x1="0" x2={W} y1={y(0)} y2={y(0)} className="axis" />
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="3" fill="var(--accent)" />
    </svg>
  );
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
