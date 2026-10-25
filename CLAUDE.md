# CLAUDE.md

Notes for Claude Code sessions in this repo.

## Project
NCPT Books app: a phone-first PWA (React + Vite + TypeScript) that fronts the NCPT Books Google Sheet for Wade and Julie. Plan and decisions (authoritative): `~/Projects/CFO/ncpt_books/docs/MOBILE-APP-PLAN.md`. Phase 1 (read-only Today + unpaid list) is built; phases 2-5 are in README ROADMAP.

## Deploy rule
GitHub Pages from `main` via `.github/workflows/deploy.yml`. NOT enabled: there is no remote. Do not create a GitHub repo, add a remote or push until Wade okays it (private repo, SSH remote `git@github.com:wsias714/ncpt-app.git`). Work on a branch, run `npm run check`, merge to `main` to deploy. At that point also register the app (bench `config/projects.json`, `bench/projects/`, `obligations/reference/apps.md`).

## Data
- Source of truth is the NCPT Books Sheet (id in `.env.example`), read with the signed-in user's own Google token. No Dropbox sync here: patient data must stay in Julie's Google Workspace (CMIA).
- Wade and Julie share one Google account, so the app asks "Who is this?" and stamps that label (`src/lib/who.ts`) on every write.
- Sheet data lives in per-session memory only. Never put sheet data in localStorage or IndexedDB (until phase 5, codes and amounts only).
- Tab layouts come from `~/Projects/CFO/ncpt_books/publish.py` and `close.py`. The generated tabs are rebuilt by `ncpt_books`; the app never edits them. Writes (later phases) go only to input tabs.

## Rules
- The app never sends email, pays, or files anything. It drafts, records and queues; a person executes.
- No patient identifiers (names, emails, phones, addresses, clinical info) in the repo, fixtures, tests, logs, storage or screenshots. Use codes ("Customer V") and made-up numbers.
- No secrets. The OAuth client ID is public; there is no client secret anywhere.
- Run `npm run check` before every commit.
