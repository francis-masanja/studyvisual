# StudyVisual Project Instructions

Architecture, conventions, and workflows for the StudyVisual project.

## Tech stack
- **Frontend:** React 19, Vite 8, Tailwind CSS 4, Framer Motion, Radix UI, react-router-dom.
- **Backend:** Vercel Functions (Node.js); locally wrapped by Express in `scripts/dev-server.ts`.
- **Database:** Turso (LibSQL) via `@libsql/client`.
- **Mobile:** Capacitor 8 (`android/`, `ios/`).

## Architecture
- **`api/`** — one file per endpoint, each exporting a Vercel-compatible default handler. Must stay at the repo root (Vercel routing).
- **`api/db.ts`** — the only place that creates the LibSQL client. Also exports `errorMessage(unknown)` for consistent error logging/responses.
- **`scripts/dev-server.ts`** — Express server on `127.0.0.1:3000` that wraps every handler so `npm run dev` runs the same code Vercel will run. Vite proxies `/api/*` to it.
- **`src/pages/`** — route-level views (`LandingPage`, `Dashboard`, `Settings`).
- **`src/features/`** — `StudyVisualizer.tsx` (flashcards / quiz / notes rendering).
- **`src/components/ui/`** — shared primitives (e.g. `AuthDialog`).
- **`src/lib/api.ts`** — typed fetch helpers and API response interfaces (`Material`, `Category`, `DailyQuestion`). Data fetching from components goes through this module, never inline `fetch` inside effects.
- **`src/lib/parser.ts`** — parses uploaded Markdown/JSON into sections/cards.
- **`public/`** — static assets plus the downloadable upload templates (`template.md`, `template.json`, `template-quiz.json`).

## Commands
| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite + local API together |
| `npm run build` | `tsc -b` + `vite build` (type-checks `src`, `vite.config.ts`, `api/`, `scripts/`) |
| `npm run typecheck` | Type-check only |
| `npm run lint` | ESLint (must be 0 errors) |
| `npm run db:init` | Create/seed schema |
| `npm run icons` | Generate app icons from `assets/` |

Type-checking is split across `tsconfig.app.json` (src), `tsconfig.node.json` (vite config), and `tsconfig.api.json` (api + scripts + capacitor config); the root `tsconfig.json` references all three. All three must stay green.

## Environment variables
Always use these names for Turso:
- `VITE_TURSO_URL`: LibSQL/HTTPS URL.
- `VITE_TURSO_AUTH_TOKEN`: auth token.
- `VITE_TURSOR_API_KEY`: supported as a fallback for the token (legacy setups).

`.env` holds real credentials — never commit it (it is gitignored).

## Code style
- TypeScript everywhere; `strict` is not enabled, but `noUnusedLocals` and `verbatimModuleSyntax` are — avoid unused imports and use `import type` for type-only imports.
- Functional components and hooks; `cn()` for conditional Tailwind classes.
- "Cozy" theme tokens: `cozy-bg`, `cozy-text`, `cozy-primary`, `cozy-secondary`, `cozy-accent`, `cozy-card`, `cozy-muted`.
- ESLint enforces React Hooks rules: **no `setState` calls directly in an effect body.** Fetch in effects as `promise.then(...).catch(...).finally(...)` (or call helpers defined in another module, e.g. `src/lib/api.ts`), or initialize state lazily from `localStorage` in `useState(() => ...)`.
- `catch` clauses are untyped (`unknown`) — use `instanceof Error` / `errorMessage()` rather than touching `.message` directly. Avoid `any`.

## Verification before finishing
Run `npm run lint && npm run typecheck && npm run build`. For API changes, also `npm run dev` and `curl http://127.0.0.1:3000/api/ping`.
