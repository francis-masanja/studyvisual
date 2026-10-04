# StudyVisual

Upload study material as Markdown or JSON and read it as flashcards, quizzes, and formatted notes — in a cozy theme, on web or on your phone (Capacitor).

## Features

- **Upload & visualize** notes (Markdown/JSON) as sections, flashcards, and MCQ quizzes.
- **Daily challenge** question stream with scoring and streaks.
- **Community tab** for sharing materials between users; categories and per-user progress.
- **Local templates** for the upload formats: [`public/template.md`](public/template.md), [`public/template.json`](public/template.json), [`public/template-quiz.json`](public/template-quiz.json) — also linked from the upload dialogs in the app.
- **Mobile builds** via Capacitor (Android/iOS) with generated app icons.

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19, Vite 8, Tailwind CSS 4, Framer Motion, Radix UI |
| Routing | `react-router-dom` |
| Backend | Vercel Functions (`api/`), Node.js handlers wrapped by Express locally |
| Database | Turso (LibSQL via `@libsql/client`) |
| Mobile | Capacitor 8 (`android/`, `ios/`) |

## Quick start

```bash
npm ci
cp .env.example .env      # fill in VITE_TURSO_URL + VITE_TURSO_AUTH_TOKEN
npm run db:init           # creates tables + default categories
npm run dev               # Vite (5173) + local API (3000)
```

Open http://localhost:5173 — Vite proxies `/api/*` to the local Express server on `127.0.0.1:3000`.

> Node.js 22+ required. `npm ci` may prompt to approve install scripts for `sharp` (icon tooling): `npm install-scripts approve sharp`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server + local API server together |
| `npm run build` | Type-check all projects (`tsc -b`) + production build |
| `npm run typecheck` | Type-check `src/`, `vite.config.ts`, `api/`, `scripts/` |
| `npm run lint` | ESLint over the whole repo |
| `npm run db:init` | Create/seed the database schema |
| `npm run icons` | Generate Android/iOS app icons from `assets/` |
| `npm run preview` | Preview the production build |

## Project structure

```
api/                  Vercel serverless handlers (one file = one endpoint)
  db.ts               LibSQL client + shared execute/error helpers
  ping.ts             Health check with DB connectivity report
scripts/
  dev-server.ts       Express wrapper so every handler runs locally on :3000
  init-db.ts          Schema bootstrap (users, materials, progress, categories, questions, attempts)
src/
  pages/              Route-level views: LandingPage, Dashboard, Settings
  features/           StudyVisualizer (flashcards / quiz / notes rendering)
  components/ui/      Reusable primitives (e.g. AuthDialog)
  hooks/              useUser (auth + theme preference)
  lib/                api.ts (typed HTTP client), parser.ts (upload formats), utils.ts
public/               Static assets + upload templates (template*.md/json)
assets/               Source artwork for `npm run icons`
android/, ios/        Capacitor native projects
docs/api.md           API endpoint reference
```

`api/` and `public/` must stay at the repo root: Vercel maps `api/` to serverless functions and `public/` to static files.

## Environment variables

| Name | Purpose |
| --- | --- |
| `VITE_TURSO_URL` | LibSQL URL (`libsql://…` or `https://…`) |
| `VITE_TURSO_AUTH_TOKEN` | Auth token for Turso |
| `VITE_TURSOR_API_KEY` | Fallback name for the auth token (legacy setups) |

See [docs/api.md](docs/api.md) for endpoints, request/response shapes, and the database schema.

## Deployment

- **Web:** Vercel auto-detects the Vite app and the `api/` functions. Set the three env vars above in the project settings.
- **Mobile:** `npm run icons`, then `npx cap sync` / `npx cap open android|ios`. GitHub Actions build both apps (`.github/workflows/`).

## Quality gates

`npm run lint`, `npm run typecheck`, and `npm run build` must all pass — the `CI` workflow runs them on every push and pull request.
