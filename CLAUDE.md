# CLAUDE.md

Notes for Claude Code sessions in this repo.

## Project
NCPT Books app: a phone-first PWA (React + Vite + TypeScript) that fronts the NCPT Books Google Sheet for Wade and Julie. Plan and decisions (authoritative): `~/Projects/CFO/ncpt_books/docs/MOBILE-APP-PLAN.md`. Built: Today, Transactions (booking sheet), Reports, Unpaid. The app reads only the `App *` tabs plus `P&L`, `Balance Sheet`, `Accounts` and writes only appended rows to `App Decisions` and `App Send` (invoice approvals). It also reads `App Outbox` (recipients and email text) at runtime when names are on, like Customer Codes (never read `Invoices`, `Journal`, `Customers`, `Payers`, `Review`); phases 2-5 are in README ROADMAP.

## Deploy rule
GitHub Pages from `main` via `.github/workflows/deploy.yml`, live at https://wsias714.github.io/ncpt-app/ (remote `git@github.com:wsias714/ncpt-app.git`). Push to `main` only after `npm run check` exits 0 (gate on the exit code, never on piped output). Features that can send or file stay inert until their server-side switch is on (e.g. invoice sending needs Send.gs deployed and `send_enabled = yes`).

## Data
- Source of truth is the NCPT Books Sheet (id in `.env.example`), read with the signed-in user's own Google token. No Dropbox sync here: patient data must stay in Julie's Google Workspace (CMIA).
- Wade and Julie share one Google account, so the app asks "Who is this?" and stamps that label (`src/lib/who.ts`) on every write.
- Sheet data lives in per-session memory only. Never put sheet data in localStorage or IndexedDB (until phase 5, codes and amounts only).
- Tab layouts come from `~/Projects/CFO/ncpt_books/publish.py` and `close.py`. The generated tabs are rebuilt by `ncpt_books`; the app never edits them. Writes (later phases) go only to input tabs.

## Customer names (runtime only)
- Names are displayed from the user's own Google Sheet (`Customer Codes` tab, [Customer, Code]) at runtime only, held in memory for the session (`src/lib/names.ts`). Never in code, repo, fixtures (made-up "Doe, Pat" names only), build output, localStorage/IndexedDB or logs. Only the `ncpt.names` boolean preference is stored.
- AI tools driving the app MUST always open it with `?names=off` (e.g. `http://localhost:5173/?names=off`). That skips the `Customer Codes` fetch entirely. Never screenshot or read a page that has names on. Do not read the `Customers`, `Payers`, `Journal` or `Review` tabs.

## Rules
- The app never pays or files anything. It never sends email itself: Julie or Wade approves a previewed invoice email (Wade, 2026-10-28) and the Apps Script in Julie's account sends it after re-checking the draft. AI tools never approve, send or read `App Outbox` (it is skipped with `?names=off`). Never add a Gmail or other new OAuth scope to the app for this.
- No patient identifiers (names, emails, phones, addresses, clinical info) in the repo, fixtures, tests, logs, storage or screenshots. Use codes ("Customer V") and made-up numbers.
- No secrets. The OAuth client ID is public; there is no client secret anywhere.
- Run `npm run check` before every commit.
