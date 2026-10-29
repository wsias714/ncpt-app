import { useState } from "react";

// Copies exactly `value` to the clipboard (for pasting into a portal). Falls back to a hidden textarea when the
// Clipboard API is unavailable (non-secure context, old webview). Nothing is stored.
async function copyText(value: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(value); return true; } catch { /* fall through */ }
  try {
    const t = document.createElement("textarea");
    t.value = value; t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    const ok = document.execCommand("copy");
    t.remove();
    return ok;
  } catch { return false; }
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  const click = async () => {
    setState((await copyText(value)) ? "done" : "fail");
    setTimeout(() => setState("idle"), 1500);
  };
  return (
    <button type="button" className="copy" onClick={click} aria-label={`Copy ${label}: ${value}`}>
      {state === "done" ? "Copied" : state === "fail" ? "Select" : "Copy"}
    </button>
  );
}
