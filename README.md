# NCPT Books app

Phone-first PWA (React + Vite + TypeScript) that is a front end to the NCPT Books Google Sheet. Screens: Today (cash profit over 1M/3M/6M/12M/YTD with a two-line chart, wages, invoices, needs booking, last 7 days, balances), Transactions (search/filters, booking sheet), Reports (income statement, balance sheet, trend charts), Unpaid. It reads only the masked, app-ready tabs `App Summary`, `App Transactions`, `App Monthly`, `App Invoices`, `App Decisions`, `P&L`, `Balance Sheet`, `Accounts` (missing tabs show empty states). The writes are appended rows on four input tabs: `App Decisions` (Entry, Account, Note, Who, When; Python applies it at the next publish), `App Send` (Number, Fingerprint, Action, Who, When; see Invoices below), `App Approvals` and `App Filings` (see Payroll run and Filing kits below). It also reads `App Payroll` and `App Kits`, and `App Matches` (proposed deposit matches, see Invoices) and `App Upcoming` (the To do list on Invoices: expected invoices for the next 7 days from Julie's calendar, codes only, works with names off, read separately so a missing tab is just empty). `App Send` also takes `DRAFT_VISIT`, `MARK_SENT`, `MARK_ISSUED`, `VOID` and `CLOSE_OUT` rows, and `App Decisions` takes `IGNORE` (see Invoices and Transactions below). Raw `Invoices`, `Journal`, `Customers`, `Payers`, `Review` are never read. The only other tab read is `Customer Codes` (names, see below), and only when names are on. Target state and decisions: `~/Projects/CFO/ncpt_books/docs/MOBILE-APP-PLAN.md`.

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
- Invoices come from `App Invoices` (codes only; anything not shaped like a code shows as "Unlabeled"). Columns: Number, Code, Invoice date, Due, Total, Status (DRAFT SENT ISSUED PAID VOID WRITTEN_OFF), Source, Paid on, Deposit, Email draft (Y/N). An older 7-column grid still parses (then "paid in last 30 days" uses the invoice date and every draft counts as ready to send).
- Booking: rows in a closed month (`Locked` = yes) cannot be re-booked. A saved decision shows "pending" until the published Category code matches (IGNORE compares case-insensitively). Python writes column F (Status) of `App Decisions` back after each build: `applied | ignored | superseded | rejected: <why>`; a rejected decision is not pending and the row shows "not applied: <why>".
- Ignore: the booking sheet has an "Ignore this line" choice that needs a reason (no names) and appends `[Entry, IGNORE, Note, Who, When]`. An ignored line (Status `ignored`, Category code `IGNORE`, name `Ignored: <reason>`) shows muted as "Ignored: <reason>" and stays out of the books. A deposit shows its `Applied to` (`App Transactions` column 11, e.g. `Invoice 3534 (Customer C)`) as a sub-line.

## PII checks

`npm run check` runs `scripts/pii-scan.mjs` (tripwire for emails, SSN, phone, street, "Customer <Name>" patterns in `src/` and `public/`). Manual step, since the guard lives in the CFO repo: from `~/Projects/CFO` run `python3 -m ncpt_books.pii_guard ~/Projects/ncpt-app` before each commit. It loads names from the Drive Customers and Payers tabs (a Google call), so it was not run during the offline scaffold.

## Invoices: approve and send from the phone

The Invoices screen (nav, was Unpaid), top to bottom (an **Awaiting your OK** section sits above all of these when there are proposed deposit matches, see below):
1. **To do, next 7 days** (`App Upcoming`, `src/lib/upcoming.ts`; works with names off): per day one row per code with visit time, billing type, amount (monthly rows: "so far"), a State chip (UPCOMING READY WAVE DRAFTED SENT ISSUED PAID) and a Create invoice button that is enabled only for READY (otherwise disabled with the reason, e.g. "visit not over yet"; WAVE rows are muted, "bill in Wave", no button). Tap opens a confirm sheet ("Bill Tue 11/3, 9:00-10:30, 1.5 h, $200?", with a warning when the script's note says there is no visit note yet); confirming appends `[Key, Fingerprint, DRAFT_VISIT, Who, When]` to `App Send` and the button stays disabled for the session ("Requested; the preview appears under Ready to send in about a minute, tap Refresh"). Unlinked calendar events show only as a count. Contract test: `src/lib/upcoming.golden.json` is a copy of the Apps Script's golden grid (CFO `ncpt_books/apps-script/upcoming.golden.json`; synthetic).
2. **Ready to send** (`App Outbox` previews, names on only): each READY invoice email exactly as it will go out: recipient, subject, body, PDF link. Approve and send, then confirm, appends one row to `App Send`. The Apps Script (`CFO/ncpt_books/apps-script/Send.gs`, every minute) re-reads the Gmail draft, refuses if anything differs from the fingerprint you previewed (or the invoice is no longer a DRAFT, or it was already sent), and otherwise sends from Julie's account and marks the invoice SENT. A Cancel button withdraws a send before the script picks it up. A second button, "No email: close out with the deposit" (behind a confirm sheet), appends `[Number, "", CLOSE_OUT, Who, When]` for a patient who pays in person: the script discards the Gmail draft and sets the invoice ISSUED, counted as owed until the bank deposit matcher closes it.
3. **Needs attention** (`App Invoices` DRAFT with Email draft N; hidden when empty): Mark sent / Mark issued / Void, each behind a confirm sheet, each appends `[Number, "", MARK_SENT | MARK_ISSUED | VOID, Who, When]` to `App Send`. Replaces the old "Drafts (no preview yet)" list.
4. **Awaiting payment** (SENT or ISSUED, oldest first, days outstanding) and 5. **Recently paid** (PAID, last 30 days, with Paid on and Deposit): both by code, so they work with names off.
The generic "Create invoices from visits" button is gone (the old `DRAFT` action stays in the type, no screen uses it). Dev demo: `?demo=1&names=off` shows every State; `&upcoming=none` (tab not published), `&outbox=on` (made-up previews with names off). Demo mode never writes.
- `App Outbox` (written by the script) holds recipients and email text, so it is read like Customer Codes: only with Names on, into memory only, never by AI tools (`?names=off` skips it, and the screen says so). Demo mode (`?demo=1`, dev server) uses made-up fixtures.
- Sending stays OFF until Invoice Settings has `send_enabled = yes` (flip it at the Wave cutover).
- No new Google scopes: the app still uses spreadsheets + drive.file; only the script's own Gmail scope sends.

**Deposit matches (`App Matches`).** Python proposes which invoice(s) a bank deposit paid and publishes the generated tab `App Matches` (Match, Deposit date, Amount, Rail, Confidence, Code, Invoices, Invoice total, Variance, Status, Why, Alternatives; codes only, read on its own so a missing tab is just nothing shown). Each `proposed` row is a card in **Awaiting your OK** at the top of Invoices (also a "N deposits waiting for your OK" line on Today): amount, rail, date, code and invoice(s), a confidence chip (low in the warn colour), the Why line, Variance, and "Could also be:" for medium and low. **Approve** or **Not this one**, each behind a confirm sheet, appends ONE row `[match:<Match id>, APPROVE | REJECT, Note, Who, When]` to `App Decisions` (the same writer as a booking); Python validates it, fills the Status column and, after a reject, proposes the next best match. The card then shows "Approved. It updates within the hour (Refresh)" and its buttons are gone for the session (an earlier answer still found in `App Decisions` also shows as answered). `validated` matches are not listed here: the paid invoice shows under Recently paid. Demo (`?demo=1&names=off`) has a high and a low confidence card and writes nothing (`&matches=none` hides them). Contract test: `src/lib/matches.golden.json`.

## Deadlines

The Deadlines screen (nav "Deadlines", "Due" on a phone) reads `App Deadlines` (codes only, generated by `ncpt_books/compliance.py`; header Id, Title, Domain, Kind, Period, Due, Raw due, Rolled, Days left, State, Blocker, Method, Level, Verify, Bench, Note). It lists the next 90 days by week (Monday start), overdue items first, then an "Undated / to verify" list, with "Later than 90 days" and "Exempt" folded away. The days-left chip is recomputed from the due date in the browser (bands in `src/lib/deadlines.ts`: overdue or <= 7 days red, <= 30 amber, <= 90 neutral, done green, blocked grey). Today shows the soonest open item as "Next deadline". Read-only: the app files nothing. Dates may be ISO or M/D/YYYY.

## Payroll run and filing kits

Reached from Deadlines (the nav has no room for more at 390px) and a Today card. Neither screen pays, files or signs in anywhere: they show figures to copy and record what you did.
- Payroll run (`App Payroll`, long format Section, Key, Label, Amount, Due, Status, Detail; sections run, check, leg, filing, meta; built by `ncpt_books/payroll_app.py`): the run amounts, the checks (a blocking one is red and keeps Approve disabled), the four bank legs with matched/pending/mismatch chips and the exact amount to copy, and the 941 and DE 9/9C figures. Approve run (after a confirm sheet that lists the amounts and says "Payments, filings and portal sign-ins stay manual") appends `[PAYROLL_RUN, ref, fingerprint, amounts JSON, APPROVE, who, when]` to `App Approvals`; Revoke appends REVOKE. The state chip (approved, stale, none, revoked) comes from the meta row Python computes, so it updates at the next publish.
- Filing kits (`App Kits`, Kit, Period, Order, Line, Label, Value, Source, Tie, Status; built by `ncpt_books/kits.py`): each kit's fields in form order with Copy buttons, tie-outs (ok / FAIL), verify and blocked notes. A Deadlines row opens its kit when Id and Period match (DE 9C maps to the DE 9 kit). "Filed" (confirmation number, amount, date, method, then a confirm step) appends `[Id, Period, Confirmation, Amount, Filed on, Method, Who, When, Note]` to `App Filings`; the deadline turns done at the next publish.
- Missing tabs show friendly empty states. Dev demo switches: `&payroll=block`, `&payroll=none`, `&kits=none`.

## Deploy

GitHub Pages from `main` via `.github/workflows/deploy.yml`. Not enabled: no remote exists yet.

## ROADMAP

Phases from the plan (phase 1 and the transactions/reports/booking pass above are built):

2. Wade's queue: approvals (recorded, not executed), month lock request. (Per-line booking is done via App Decisions.)
3. Julie's billing: invoice approve-and-send from the phone (built 2026-10-28, not yet live: needs the script deployed and `send_enabled`), payment received, unpaid list with names while online.
4. Receipts and mileage: photo receipts to Drive `Receipts/<year>/`, mileage owed (Stride stays the source).
5. Polish: reminders via the Bench briefing, home-screen install, offline cache with codes only.
Also open: a "month net" figure (the Dashboard tab publishes YTD only), tax-pack items on the Today screen.
