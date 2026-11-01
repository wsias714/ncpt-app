import { useState, type ReactNode } from "react";

interface Props {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

// A bottom sheet that asks once more before an append (App Send rows). Closes on success; shows the error otherwise.
export function ConfirmSheet({ title, children, confirmLabel, danger, onConfirm, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    setBusy(true); setErr("");
    try { await onConfirm(); onClose(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Could not save"); setBusy(false); }
  };
  return (
    <div className="scrim" onClick={busy ? undefined : onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3 className="sheettitle">{title}</h3>
        {children}
        {err && <p className="warn">{err}</p>}
        <div className="btnrow">
          <button className={"btn big" + (danger ? " danger" : "")} disabled={busy} onClick={go}>{busy ? "Saving..." : confirmLabel}</button>
          <button className="btn alt" disabled={busy} onClick={onClose}>Back</button>
        </div>
      </div>
    </div>
  );
}
