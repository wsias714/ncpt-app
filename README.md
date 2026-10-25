# NCPT Books app

Phone-first PWA (React + Vite + TypeScript) that is a front end to the NCPT Books Google Sheet. Phase 1 is read-only: a Today screen and an unpaid-invoice list. Target state and decisions: `~/Projects/CFO/ncpt_books/docs/MOBILE-APP-PLAN.md`.

The app never sends, pays or files anything, and holds no patient identifiers. Customers appear as codes ("Customer V") only.

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
- Reader (`src/lib/sheets.ts`): Sheets REST `values:batchGet` for tabs Dashboard, Close, Invoices, cached in memory per session. Nothing from the Sheet touches localStorage or IndexedDB. The service worker caches the app shell only.
- Parsers (`src/lib/parse.ts`): pure, unit-tested against made-up fixtures (`src/lib/fixtures.ts`).
- The AR list reads the **Invoices** tab (there is no separate AR tab in the Sheet) and keeps only unpaid rows. The Customer column is reduced to a code; anything not shaped like a code shows as "Unlabeled".

## PII checks

`npm run check` runs `scripts/pii-scan.mjs` (tripwire for emails, SSN, phone, street, "Customer <Name>" patterns in `src/` and `public/`). Manual step, since the guard lives in the CFO repo: from `~/Projects/CFO` run `python3 -m ncpt_books.pii_guard ~/Projects/ncpt-app` before each commit. It loads names from the Drive Customers and Payers tabs (a Google call), so it was not run during the offline scaffold.

## Deploy

GitHub Pages from `main` via `.github/workflows/deploy.yml`. Not enabled: no remote exists yet.

## ROADMAP

Phases from the plan (phase 1 above is built):

2. Wade's queue: Review decisions, approvals (recorded, not executed), month lock request.
3. Julie's billing: invoice drafts opened in Gmail (she presses send), payment received, unpaid list with names while online.
4. Receipts and mileage: photo receipts to Drive `Receipts/<year>/`, mileage owed (Stride stays the source).
5. Polish: reminders via the Bench briefing, home-screen install, offline cache with codes only.
Also open: a "month net" figure (the Dashboard tab publishes YTD only), tax-pack items on the Today screen.
