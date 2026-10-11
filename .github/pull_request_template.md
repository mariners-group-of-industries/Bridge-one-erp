## What & why

<!-- One or two sentences. Link the issue/task if there is one. -->

## Module / area

- [ ] Platform (shell, `components/ui`, `lib`, CI)
- [ ] Configuration
- [ ] Other module: <!-- name -->

## Checklist

- [ ] Targets the **parent** branch (see `BRANCHING.md`)
- [ ] `npm run lint`, `npm run typecheck`, `npm test` pass locally
- [ ] UI uses `components/ui` + the page patterns (workspace / list view / form view) — no raw palette colours (`bg-blue-600`, `text-zinc-500` …)
- [ ] Loading, empty and error states handled
- [ ] Schema change? One migration in this PR, rebased on the parent branch, never edits a merged migration
- [ ] New page registered in the module's `navigation.ts` (sidebar, breadcrumbs, search)

## Screenshots

<!-- Light and dark mode for UI changes. -->
