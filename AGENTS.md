# Agent instructions

- The app lives in `frontend/` (Next.js 16 — read `frontend/AGENTS.md` and the bundled docs
  in `frontend/node_modules/next/dist/docs/` before using unfamiliar APIs).
- Team rules and ownership: `CONTRIBUTING.md`. Branch flow: `BRANCHING.md`.
- UI must follow the ERPNext-style patterns in `docs/ui-guide.md`: build from
  `src/components/ui` + `src/components/layout`, use semantic colour tokens only, register
  new pages in the module's `navigation.ts`.
- Before finishing: `npm run lint && npm run typecheck && npm test` in `frontend/`.
