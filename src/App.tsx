import { useCallback, useMemo, useState } from "react";
import { clientIdConfigured, getToken, signIn, signOut } from "./lib/auth.ts";
import { parseClose, parseDashboard, parseInvoices } from "./lib/parse.ts";
import { AuthExpiredError, createReader, type Tabs } from "./lib/sheets.ts";
import { getWho, setWho, type Who } from "./lib/who.ts";
import { ArScreen } from "./screens/ArScreen.tsx";
import { TodayScreen } from "./screens/TodayScreen.tsx";

const reader = createReader(getToken);
const todayIso = () => new Date().toISOString().slice(0, 10);

export function App() {
  const [who, setWhoState] = useState<Who | null>(getWho());
  const [signedIn, setSignedIn] = useState(false);
  const [tabs, setTabs] = useState<Tabs | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [screen, setScreen] = useState<"today" | "ar">("today");

  const load = useCallback(async (force: boolean) => {
    setBusy(true); setError("");
    try {
      setTabs(await reader.read(force));
    } catch (e) {
      if (e instanceof AuthExpiredError) { setSignedIn(false); setTabs(null); }
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally { setBusy(false); }
  }, []);

  const doSignIn = async () => {
    setError("");
    try { await signIn(); setSignedIn(true); await load(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Sign-in failed"); }
  };
  const doSignOut = () => { signOut(); reader.clear(); setTabs(null); setSignedIn(false); };

  const data = useMemo(() => {
    if (!tabs) return null;
    const today = todayIso();
    return { dash: parseDashboard(tabs.Dashboard), close: parseClose(tabs.Close), ar: parseInvoices(tabs.Invoices, today), today };
  }, [tabs]);

  if (!who) {
    return (
      <main className="center">
        <h1>Who is this?</h1>
        <p className="muted">Wade and Julie share one Google sign-in. This label is saved on this device and stamped on every change.</p>
        {(["Wade", "Julie"] as Who[]).map((w) => (
          <button key={w} className="btn big" onClick={() => { setWho(w); setWhoState(w); }}>{w}</button>
        ))}
      </main>
    );
  }

  if (!signedIn || !data) {
    return (
      <main className="center">
        <h1>NCPT Books</h1>
        <p className="muted">Hi {who}. Sign in with the NCPT Google account to read the books.</p>
        {!clientIdConfigured() && <p className="warn">Google client ID is not configured (VITE_GOOGLE_CLIENT_ID).</p>}
        <button className="btn big" onClick={doSignIn} disabled={busy || !clientIdConfigured()}>
          {busy ? "Loading..." : "Sign in with Google"}
        </button>
        {error && <p className="warn">{error}</p>}
        <button className="link" onClick={() => { setWhoState(null); try { localStorage.removeItem("ncpt.who"); } catch { /* ignore */ } }}>Not {who}?</button>
      </main>
    );
  }

  return (
    <div className="shell">
      <header>
        <strong>NCPT Books</strong>
        <span className="muted">{who}</span>
        <button className="link" onClick={() => load(true)} disabled={busy}>{busy ? "..." : "Refresh"}</button>
        <button className="link" onClick={doSignOut}>Sign out</button>
      </header>
      {error && <p className="warn pad">{error}</p>}
      <main className="content">
        {screen === "today" ? <TodayScreen dash={data.dash} close={data.close} ar={data.ar} /> : <ArScreen items={data.ar} />}
      </main>
      <nav>
        <button className={screen === "today" ? "on" : ""} onClick={() => setScreen("today")}>Today</button>
        <button className={screen === "ar" ? "on" : ""} onClick={() => setScreen("ar")}>Unpaid</button>
      </nav>
    </div>
  );
}
