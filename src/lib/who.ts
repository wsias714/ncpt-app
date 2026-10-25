// "Who is this?" label. Wade and Julie share one Google account, so every write is stamped
// with this label to keep the audit trail apart. It is a label only, never an identity check.
export type Who = "Wade" | "Julie";
const KEY = "ncpt.who";

export function getWho(): Who | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "Wade" || v === "Julie" ? v : null;
  } catch { return null; }
}

export function setWho(w: Who): void {
  try { localStorage.setItem(KEY, w); } catch { /* storage unavailable: label lives in memory only */ }
}

export interface Stamp { by: Who; at: string }

// Attach to every write (none exist in phase 1; phase 2+ must call this).
export function stamp(who: Who, now: Date = new Date()): Stamp {
  return { by: who, at: now.toISOString() };
}
