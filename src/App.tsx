import { useCallback, useEffect, useMemo, useState } from "react";
import { BookingSheet } from "./components/BookingSheet.tsx";
import { NamesContext } from "./components/NamesContext.tsx";
import { loadNameMap, makeLabeler, namesEnabled, namesForcedOff, NO_NAMES, saveNamesPref, savedNamesPref, type NameMap } from "./lib/names.ts";
import { clientIdConfigured, getToken, signIn, signOut } from "./lib/auth.ts";
import { buildModel } from "./lib/model.ts";
import { NO_FILTER, type Decision, type Tx, type TxFilter } from "./lib/parse.ts";
import { AuthExpiredError, createReader, decisionRow, type Tabs } from "./lib/sheets.ts";
import { getWho, setWho, type Who } from "./lib/who.ts";
import { ArScreen } from "./screens/ArScreen.tsx";
import { ReportsScreen } from "./screens/ReportsScreen.tsx";
import { TodayScreen } from "./screens/TodayScreen.tsx";
import { TransactionsScreen } from "./screens/TransactionsScreen.tsx";

const reader = createReader(getToken);
const todayIso = () => new Date().toISOString().slice(0, 10);

type Screen = "today" | "tx" | "reports" | "ar";
const NAV: [Screen, string][] = [["today", "Today"], ["tx", "Transactions"], ["reports", "Reports"], ["ar", "Unpaid"]];

export function App() {
  const [who, setWhoState] = useState<Who | null>(getWho());
  const [signedIn, setSignedIn] = useState(false);
  const [tabs, setTabs] = useState<Tabs | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [screen, setScreen] = useState<Screen>("today");
  const [filter, setFilter] = useState<TxFilter>(NO_FILTER);
  const [booking, setBooking] = useState<Tx | null>(null);
  const [sent, setSent] = useState<Decision[]>([]); // this session only, memory
  // ?names=off (AI/test tooling) forces names off for this page load and hides the toggle.
  const forcedOff = namesForcedOff(window.location.search);
  const [namesPref, setNamesPref] = useState(() => savedNamesPref());
  const namesOn = namesEnabled(window.location.search, namesPref);
  const [nameMap, setNameMap] = useState<NameMap>(NO_NAMES); // code -> display name, memory only

  useEffect(() => {
    let live = true;
    if (!signedIn || !namesOn) { setNameMap(NO_NAMES); return; }
    loadNameMap(namesOn, () => reader.readCustomerCodes())
      .then((m) => { if (live) setNameMap(m); })
      .catch(() => { if (live) setNameMap(NO_NAMES); }); // codes shown on any failure
    return () => { live = false; };
  }, [signedIn, namesOn]);
  const label = useMemo(() => makeLabeler(namesOn ? nameMap : NO_NAMES), [namesOn, nameMap]);
  const toggleNames = () => { const next = !namesPref; setNamesPref(next); saveNamesPref(next); };

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
  const doSignOut = () => { signOut(); reader.clear(); setNameMap(NO_NAMES); setTabs(null); setSignedIn(false); setSent([]); };

  const model = useMemo(() => (tabs ? buildModel(tabs, todayIso(), sent) : null), [tabs, sent]);

  const saveDecision = async (tx: Tx, account: string, note: string) => {
    if (!who) return;
    const row = decisionRow(tx.entry, account, note, who);
    try { await reader.appendDecision(row); }
    catch (e) { if (e instanceof AuthExpiredError) { setSignedIn(false); setTabs(null); } throw e; }
    setSent((s) => [...s, { entry: row[0], account: row[1], note: row[2], who: row[3], when: row[4] }]);
  };

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

  if (!signedIn || !model) {
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

  const go = (s: Screen) => { setScreen(s); window.scrollTo(0, 0); };
  const goTx = (reviewOnly: boolean) => { setFilter({ ...NO_FILTER, reviewOnly }); go("tx"); };
  const filterByCode = (code: string) => { setFilter({ ...NO_FILTER, code }); go("tx"); };

  return (
    <NamesContext.Provider value={label}>
    <div className="shell">
      <header>
        <strong>NCPT Books</strong>
        <span className="muted">{who}</span>
        {forcedOff
          ? <span className="muted">Names off</span>
          : <button className="link" onClick={toggleNames} aria-pressed={namesOn}>Names {namesOn ? "on" : "off"}</button>}
        <button className="link" onClick={() => load(true)} disabled={busy}>{busy ? "..." : "Refresh"}</button>
        <button className="link" onClick={doSignOut}>Sign out</button>
      </header>
      {error && <p className="warn pad">{error}</p>}
      <main className="content">
        {screen === "today" && <TodayScreen m={model} openTx={setBooking} goUnpaid={() => go("ar")} goTransactions={goTx} goReports={() => go("reports")} />}
        {screen === "tx" && <TransactionsScreen m={model} filter={filter} setFilter={setFilter} openTx={setBooking} />}
        {screen === "reports" && <ReportsScreen m={model} filterByCode={filterByCode} />}
        {screen === "ar" && <ArScreen items={model.invoices} today={model.today} />}
      </main>
      <nav>
        {NAV.map(([s, label]) => (
          <button key={s} className={screen === s ? "on" : ""} onClick={() => (s === "tx" ? goTx(false) : go(s))}>{label}</button>
        ))}
      </nav>
      {booking && (
        <BookingSheet tx={booking} accounts={model.accounts} latest={model.latest.get(booking.entry)}
          onSave={(account, note) => saveDecision(booking, account, note)} onClose={() => setBooking(null)} />
      )}
    </div>
    </NamesContext.Provider>
  );
}
