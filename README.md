# NCPT Books app

Phone-first PWA (React + Vite + TypeScript) that is a front end to the NCPT Books Google Sheet. Screens: Today (cash profit, wages, invoices, needs booking, last 7 days, balances), Transactions (search/filters, booking sheet), Reports (income statement, balance sheet, trend charts), Unpaid. It reads only the masked, app-ready tabs `App Summary`, `App Transactions`, `App Monthly`, `App Invoices`, `App Decisions`, `P&L`, `Balance Sheet`, `Accounts` (missing tabs show empty states). The writes are appended rows on two input tabs: `App Decisions` (Entry, Account, Note, Who, When; Python applies it at the next publish) and `App Send` (Number, Fingerprint, Action, Who, When; see Invoices below). Raw `Invoices`, `Journal`, `Customers`, `Payers`, `Review` are never read. The only other tab read is `Customer Codes` (names, see below), and only when names are on. Target state and decisions: `~/Projects/CFO/ncpt_books/docs/MOBILE-APP-PLAN.md`.

The app never pays or files anything and never sends email itself (an approved invoice is emailed by the Apps Script in Julie's account, see Invoices below), and holds no patient identifiers in code, repo, fixtures or build output. Data tabs carry codes ("Customer V") only.

## Customer names (runtime only)

Names are displayed from the user's own Google Sheet at runtime and nowhere else. After sign-in the browser reads the tab `Customer Codes` (header `[Customer, Code]`, Customer like "Last, First & First", Code like "Customer V") and keeps code -> "First Last" in memory only. Every screen then substitutes names for codes (invoices, Today, transaction descriptions; search matches names and codes). Unmapped codes stay as codes.

- Header toggle "Names on/off", default on. Only that boolean (`ncpt.names`) is saved in localStorage.
- `?names=off` forces names off for that page load, ignores the saved preference, hides the toggle and never fetches `Customer Codes`.
- Names are cleared on sign out or reload. They never touch localStorage, IndexedDB, logs or the service worker cache.
- AI tools and automated tests driving the app must always open it with `?names=off`, and must not screenshot or read pages with names on.

## Run

```
npm install
cp .env.example .env.local   # then set VITE_GOOGLE_CLIENT_ID
npm run dev                  # http://localhost:5173
npm run check                # pii scan + tests + typecheck + build
```

`VITE_GOOGLE_CLIENT_ID` is an OAuth *web application* client from the `tillerautomation` Cloud project (public, no secret). Authorized JavaScript origins must include `http://localhost:5173` and the Pages origin. Scopes: `spreadsheets`, `drive.file`.

## How it works

- Sign-in: Google Identity Services token client, token held in memory only.
- "Who is this?" (Wade or Julie): a label in localStorage, stamped on every write (`src/lib/who.ts`). Phase 1 has no writes.
- Reader (`src/lib/sheets.ts`): Sheets REST `values:batchGet` for the app tabs above (falls back to tab-by-tab if one is not published yet), cached in memory per session. Nothing from the Sheet touches localStorage or IndexedDB. The service worker caches the app shell only.
- Parsers (`src/lib/parse.ts`): pure, unit-tested against made-up fixtures (`src/lib/fixtures.ts`).
- Invoices come from `App Invoices` (codes only; anything not shaped like a code shows as "Unlabeled"). It has no paid date, so "paid in last 30 days" uses invoice date.
- Booking: rows in a closed month (`Locked` = yes) cannot be re-booked. A saved decision shows "pending" until the published Category code matches.

## PII checks

`npm run check` runs `scripts/pii-scan.mjs` (tripwire for emails, SSN, phone, street, "Customer <Name>" patterns in `src/` and `public/`). Manual step, since the guard lives in the CFO repo: from `~/Projects/CFO` run `python3 -m ncpt_books.pii_guard ~/Projects/ncpt-app` before each commit. It loads names from the Drive Customers and Payers tabs (a Google call), so it was not run during the offline scaffold.

## Invoices: approve and send from the phone

The Invoices screen (nav, was Unpaid) lists each READY invoice email exactly as it will go out: recipient, subject, body, PDF link. Approve and send, then confirm, appends one row to `App Send`. The Apps Script (`CFO/ncpt_books/apps-script/Send.gs`, every minute) re-reads the Gmail draft, refuses if anything differs from the fingerprint you previewed (or the invoice is no longer a DRAFT, or it was already sent), and otherwise sends from Julie's account and marks the invoice SENT. A Cancel button withdraws a send before the script picks it up. "Create invoices from visits" asks the script to draft now instead of waiting for its 2-hour trigger.
- `App Outbox` (written by the script) holds recipients and email text, so it is read like Customer Codes: only with Names on, into memory only, never by AI tools (`?names=off` skips it, and the screen says so). Demo mode (`?demo=1`, dev server) uses made-up fixtures.
- Sending stays OFF until Invoice Settings has `send_enabled = yes` (flip it at the Wave cutover).
- No new Google scopes: the app still uses spreadsheets + drive.file; only the script's own Gmail scope sends.

## Deploy

GitHub Pages from `main` via `.github/workflows/deploy.yml`. Not enabled: no remote exists yet.

## ROADMAP

Phases from the plan (phase 1 and the transactions/reports/booking pass above are built):

2. Wade's queue: approvals (recorded, not executed), month lock request. (Per-line booking is done via App Decisions.)
3. Julie's billing: invoice approve-and-send from the phone (built 2026-10-28, not yet live: needs the script deployed and `send_enabled`), payment received, unpaid list with names while online.
4. Receipts and mileage: photo receipts to Drive `Receipts/<year>/`, mileage owed (Stride stays the source).
5. Polish: reminders via the Bench briefing, home-screen install, offline cache with codes only.
Also open: a "month net" figure (the Dashboard tab publishes YTD only), tax-pack items on the Today screen.
