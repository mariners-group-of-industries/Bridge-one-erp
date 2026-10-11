# Branching Strategy

Branches follow the ERP module hierarchy. Each branch is created from its parent
and merged back into its parent through a Pull Request.

```text
main                                   production (protected)
└── development                        integration (protected)
    ├── platform/main                  design system, app shell, shared libs, CI
    │   └── platform/<feature>         e.g. platform/data-table-filters
    ├── configuration/main             Configuration module
    │   └── configuration/<feature>    e.g. configuration/company-profile
    ├── selling/main
    ├── buying/main
    ├── stock/main
    ├── accounting/main
    └── hr/main                        (names match the module ids in src/lib/navigation)
```

Git cannot have a branch `configuration` and a branch `configuration/...` at the
same time, so every module level uses a `/main` suffix.

## Flow

```text
<module>/<feature>  →  <module>/main  →  development  →  main
```

1. Create a feature branch from its module branch, e.g.
   `git switch -c configuration/<feature> origin/configuration/main`
2. Commit (Conventional Commits: `feat(config): …`, `fix(ui): …`), push, and open a
   Pull Request into the **module** branch. One approval from another developer is required.
3. When a module milestone is ready, open a PR from `<module>/main` into `development`.
4. `development` is merged into `main` for releases.
5. Never commit directly to `main` or `development`.

Keep feature branches short-lived (days, not weeks) and rebase on the parent branch
before opening a PR — especially when it contains a Prisma migration.

## Legacy branches

`configuration/business-config/main` and `configuration/business-config/company-profile`
come from the first, deeper hierarchy. Merge them into `configuration/main` and use the
flatter layout above for new work.

## Repository settings (GitHub → Settings → Branches)

- Protect `main` and `development`: require a pull request, 1 approval, and the
  **CI** status check; disallow force pushes.
- Optionally protect each `<module>/main` the same way.
