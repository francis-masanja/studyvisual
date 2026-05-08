# StudyVisual Project Instructions

This document outlines the architecture, conventions, and workflows for the StudyVisual project.

## Tech Stack
- **Frontend:** React 19, Vite, Tailwind CSS 4, Framer Motion, Radix UI.
- **Backend:** Vercel Functions (Node.js) using Express for local development.
- **Database:** Turso (LibSQL).

## Architecture
- **API:** Located in the `api/` directory. Each file exports a Vercel-compatible handler.
- **Components:**
  - `src/components/layout/`: Page-level layouts (Dashboard, LandingPage, Settings).
  - `src/components/ui/`: Reusable UI components.
  - `src/components/visualizer/`: Specialized components for viewing study materials.
- **Database Logic:** Centralized in `api/db.ts`.

## Environment Variables
Always use the following names for Turso configuration:
- `VITE_TURSO_URL`: The LibSQL/HTTPS URL for the database.
- `VITE_TURSO_AUTH_TOKEN`: The authentication token for the database.

*Note: `VITE_TURSOR_API_KEY` is also supported as a fallback for the authentication token to maintain compatibility with existing setups.*

## Workflows
- **Database Initialization:** Run `npm run db:init` to set up the schema.
- **Local Development:** Run `npm run dev` to start both the Vite dev server and the local API server.

## Code Style
- Use TypeScript for all new code.
- Prefer functional components and hooks.
- Use `cn()` utility for conditional Tailwind classes.
- Follow the "cozy" theme conventions (colors: `cozy-bg`, `cozy-text`, `cozy-primary`, `cozy-secondary`, `cozy-accent`, `cozy-card`, `cozy-muted`).
