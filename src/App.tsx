import { useCallback, useEffect, useMemo, useState } from "react";
import { BookingSheet } from "./components/BookingSheet.tsx";
import { NamesContext } from "./components/NamesContext.tsx";
import { loadNameMap, makeLabeler, namesEnabled, namesForcedOff, NO_NAMES, saveNamesPref, savedNamesPref, type NameMap } from "./lib/names.ts";
import { clientIdConfigured, getToken, signIn, signOut } from "./lib/auth.ts";
import { demoActive, demoOutbox, demoTabsFor } from "./lib/demo.ts";
import { buildModel } from "./lib/model.ts";
import { parseOutbox, sendRow, type OutboxItem, type SendAction } from "./lib/outbox.ts";
import { NO_FILTER, type Decision, type Tx, type TxFilter } from "./lib/parse.ts";
import { approvalRow, type ApprovalAction, type PayrollRun } from "./lib/payroll.ts";
import { AuthExpiredError, createReader, decisionRow, type Tabs } from "./lib/sheets.ts";
import { getWho, setWho, type Who } from "./lib/who.ts";
import { ClientsScreen } from "./screens/ClientsScreen.tsx";
import { DeadlinesScreen } from "./screens/DeadlinesScreen.tsx";
import { InvoicesScreen, type Requested } from "./screens/InvoicesScreen.tsx";
import { KitScreen } from "./screens/KitScreen.tsx";
import { PayrollScreen } from "./screens/PayrollScreen.tsx";
import { ReportsScreen } from "./screens/ReportsScreen.tsx";
import { TodayScreen } from "./screens/TodayScreen.tsx";
import { TransactionsScreen } from "./screens/TransactionsScreen.tsx";

const reader = createReader(getToken);
const todayIso = () => new Date().toISOString().slice(0, 10);

// "payroll" and "kits" are reached from Deadlines and Today (the nav has no room for them at 390px); Deadlines stays lit.
type Screen = "today" | "tx" | "clients" | "reports" | "ar" | "deadlines" | "payroll" | "kits";
// [screen, label, short label for a narrow phone nav]
const NAV: [Screen, string, string][] = [["today", "Today", "Today"], ["tx", "Transactions", "Txns"], ["clients", "Clients", "Clients"], ["reports", "Reports", "Reports"], ["ar", "Invoices", "Invoices"], ["deadlines", "Deadlines", "Due"]];

export function App() {
  const demo = demoActive(window.location.search); // dev server only: fixtures, no sign-in
  const [who, setWhoState] = useState<Who | null>(demo ? "Wade" : getWho());
  const [signedIn, setSignedIn] = useState(demo);
  const [tabs, setTabs] = useState<Tabs | null>(demo ? demoTabsFor(window.location.search) : null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [screen, setScreen] = useState<Screen>("today");
  const [filter, setFilter] = useState<TxFilter>(NO_FILTER);
  const [booking, setBooking] = useState<Tx | null>(null);
  const [sent, setSent] = useState<Decision[]>([]); // this session only, memory
  const [kitSel, setKitSel] = useState<string | null>(null); // open filing kit (Id|Period)
  const [approvalSent, setApprovalSent] = useState<{ action: ApprovalAction; fingerprint: string } | null>(null); // this session, memory
  const [filed, setFiled] = useState<ReadonlySet<string>>(new Set()); // "Id|Period" recorded this session, memory
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
  // Invoice emails (recipients and text) are read like names: names on only, memory only. Demo uses made-up fixtures.
  const [outbox, setOutbox] = useState<OutboxItem[] | null>(demo ? parseOutbox(demoOutbox) : null);
  const [requested, setRequested] = useState<Requested>(new Map());
  const loadOutbox = useCallback(async () => {
    if (demo) return;
    if (!signedIn || !namesOn) { setOutbox(null); return; }
    try { setOutbox(parseOutbox(await reader.readOutbox())); } catch { setOutbox(null); }
  }, [demo, signedIn, namesOn]);
  useEffect(() => { void loadOutbox(); }, [loadOutbox]);
  const label = useMemo(() => makeLabeler(namesOn ? nameMap : NO_NAMES), [namesOn, nameMap]);
  const toggleNames = () => { const next = !namesPref; setNamesPref(next); saveNamesPref(next); };

  const load = useCallback(async (force: boolean) => {
    setBusy(true); setError("");
    try {
      setTabs(await reader.read(force));
      if (force) await loadOutbox();
    } catch (e) {
      if (e instanceof AuthExpiredError) { setSignedIn(false); setTabs(null); }
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally { setBusy(false); }
  }, [loadOutbox]);

  const doSignIn = async () => {
    setError("");
    try { await signIn(); setSignedIn(true); await load(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Sign-in failed"); }
  };
  const doSignOut = () => { signOut(); reader.clear(); setNameMap(NO_NAMES); setTabs(null); setSignedIn(false); setSent([]); setOutbox(null); setRequested(new Map()); setApprovalSent(null); setFiled(new Set()); };

  const model = useMemo(() => (tabs ? buildModel(tabs, todayIso(), sent) : null), [tabs, sent]);

  const saveDecision = async (tx: Tx, account: string, note: string) => {
    if (!who) return;
    const row = decisionRow(tx.entry, account, note, who);
    try { if (!demo) await reader.appendDecision(row); }
    catch (e) { if (e instanceof AuthExpiredError) { setSignedIn(false); setTabs(null); } throw e; }
    setSent((s) => [...s, { entry: row[0], account: row[1], note: row[2], who: row[3], when: row[4] }]);
  };

  const requestSend = async (action: SendAction, item?: OutboxItem) => {
    if (!who) return;
    const row = sendRow(action, item?.number ?? "", item?.fingerprint ?? "", who);
    try { if (!demo) await reader.appendSend(row); }
    catch (e) { if (e instanceof AuthExpiredError) { setSignedIn(false); setTabs(null); } throw e; }
    if (item && action !== "DRAFT") setRequested((r) => new Map(r).set(item.number, action));
  };

  // Payroll run approve or revoke: one appended row on App Approvals. The app pays and files nothing.
  const actOnPayroll = async (action: ApprovalAction, run: PayrollRun) => {
    if (!who) return;
    const row = approvalRow(action, run, who);
    try { if (!demo) await reader.appendApproval(row); }
    catch (e) { if (e instanceof AuthExpiredError) { setSignedIn(false); setTabs(null); } throw e; }
    setApprovalSent({ action, fingerprint: run.fingerprint });
  };

  // A filing recorded as done: one appended row per deadline item on App Filings, in order. Stops at the first failure.
  const recordFilings = async (rows: string[][], keys: string[]) => {
    const done: string[] = [];
    try {
      for (let i = 0; i < rows.length; i++) {
        if (!demo) await reader.appendFiling(rows[i]);
        done.push(keys[i]);
      }
    } catch (e) {
      if (e instanceof AuthExpiredError) { setSignedIn(false); setTabs(null); }
      throw e;
    } finally {
      if (done.length) setFiled((f) => new Set([...f, ...done]));
    }
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
        {screen === "today" && <TodayScreen m={model} openTx={setBooking} goUnpaid={() => go("ar")} goTransactions={goTx} goReports={() => go("reports")} goDeadlines={() => go("deadlines")} goPayroll={() => go("payroll")} />}
        {screen === "tx" && <TransactionsScreen m={model} filter={filter} setFilter={setFilter} openTx={setBooking} />}
        {screen === "clients" && <ClientsScreen m={model} />}
        {screen === "deadlines" && (
          <DeadlinesScreen rows={model.deadlines} kits={model.kits} payroll={model.payroll}
            openKit={(k) => { setKitSel(k); go("kits"); }} openKits={() => { setKitSel(null); go("kits"); }} openPayroll={() => go("payroll")} />
        )}
        {screen === "payroll" && <PayrollScreen run={model.payroll} recorded={approvalSent} onAct={actOnPayroll} />}
        {screen === "kits" && (
          <KitScreen kits={model.kits} deadlines={model.deadlines} today={model.today} selected={kitSel} onSelect={(k) => { setKitSel(k); window.scrollTo(0, 0); }}
            filed={filed} onFile={recordFilings} who={who} />
        )}
        {screen === "reports" && <ReportsScreen m={model} filterByCode={filterByCode} />}
        {screen === "ar" && (
          <InvoicesScreen items={model.invoices} today={model.today} outbox={outbox} requested={requested}
            onSend={(i) => requestSend("SEND", i)} onCancel={(i) => requestSend("CANCEL", i)} onDraft={() => requestSend("DRAFT")} />
        )}
      </main>
      <nav>
        {NAV.map(([s, label, short]) => (
          <button key={s} className={screen === s || (s === "deadlines" && (screen === "payroll" || screen === "kits")) ? "on" : ""} aria-label={label} onClick={() => (s === "tx" ? goTx(false) : go(s))}>
            <span className="full">{label}</span><span className="short">{short}</span>
          </button>
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
