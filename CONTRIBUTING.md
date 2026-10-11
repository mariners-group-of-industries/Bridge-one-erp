# Contributing to BridgeOne ERP

Three developers work on this repository. This file says who owns what and the rules
that keep the codebase consistent. Setup instructions are in [`frontend/README.md`](frontend/README.md),
the branch flow in [`BRANCHING.md`](BRANCHING.md), and how to build screens in
[`docs/ui-guide.md`](docs/ui-guide.md).

## Ownership

| Role | Owns | Reviews |
| --- | --- | --- |
| **Dev A — Platform** | `src/components/` (design system + shell), `src/app/globals.css`, `src/app/layout.tsx`, `src/lib/`, `src/hooks/`, `prisma/schema.prisma`, CI | Every change to those paths (see `.github/CODEOWNERS`) |
| **Dev B — Module owner** | Configuration now; Selling / Buying next | PRs of their module |
| **Dev C — Module owner** | Next module end-to-end (e.g. Stock / Accounting) | PRs of their module |

Each module lives in `src/features/<module>/` and `src/app/(erp)/<module>/` and is
owned end-to-end (schema → services → API → UI → tests) by one developer.

## Roadmap

| Phase | Status | Content |
| --- | --- | --- |
| 0 — Team setup | ✅ | CI (lint, typecheck, test, build), CODEOWNERS, PR template, branch flow, `.nvmrc` |
| 1 — Foundation | ✅ | ERPNext theme (tokens, Inter, dense type, dark mode), desk shell (navbar, breadcrumbs, sidebar, awesomebar), UI kit (`DataTable`, `Tabs`, `DropdownMenu`, `Indicator`, form fields, dialogs, toasts), page patterns, module registry |
| 2 — Migration | ✅ | Configuration rebuilt as ERPNext screens: workspace, Company Profile (single form), Business Unit list + form, Office form, child tables, quick entry dialogs, Ctrl+S save |
| 3 — Modules | ⏳ | Each developer takes a module from `src/lib/navigation/planned.ts` and builds it with the same patterns |

Still open (good first platform tasks): real authentication (`src/lib/auth/actor.ts`),
permission-aware menu, a dashboard with number cards/charts, list-view filters,
an S3 storage driver.

## Rules

1. **UI only from the kit.** Screens are built from `src/components/ui` and the three page
   patterns. Need a new primitive? Add it to the kit in a `platform/*` PR.
2. **Semantic colours only.** Use `bg-surface`, `text-ink-muted`, `border-line`, `bg-primary` …
   (defined in `globals.css`). Never raw palette classes like `bg-blue-600` in feature code —
   they break dark mode and theming.
3. **Every page handles loading, empty and error states.**
4. **The API is the contract.** UI talks to the backend only through
   `features/<module>/<area>/services/*.api.ts`; schemas in `schemas/` are shared by both sides.
5. **Database migrations:** one migration per PR, rebase before merging, never edit a merged
   migration, each developer uses their own Neon branch database.
6. **Dependencies:** add packages in a small separate PR so `package-lock.json` conflicts stay rare.
7. **Before pushing:** `npm run lint && npm run typecheck && npm test`. CI runs the same plus `build`.
8. **Next.js 16** differs from older versions — read `frontend/node_modules/next/dist/docs/`
   before using an API you have not used here (see `frontend/AGENTS.md`).
