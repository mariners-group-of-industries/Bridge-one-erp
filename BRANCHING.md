# Branching Strategy

Branches follow the ERP module hierarchy. Each branch is created from its parent
and merged back into its parent through a Pull Request.

```text
main                                              production (protected)
└── development                                   integration
    └── configuration/main                        Configuration module
        └── configuration/business-config/main    Business Configuration
            └── configuration/business-config/company-profile   Company Profile page
```

Git cannot have a branch `configuration` and a branch `configuration/business-config`
at the same time, so every parent level uses a `/main` suffix.

## Flow

```text
company-profile  →  business-config/main  →  configuration/main  →  development  →  main
```

1. Create a feature branch from its parent, e.g.
   `git switch -c configuration/business-config/<feature> origin/configuration/business-config/main`
2. Commit, push, and open a Pull Request into the **parent** branch.
3. After review, merge upward one level at a time via Pull Requests.
4. Never commit directly to `main` or `development`.

## Future modules

```text
development
├── configuration/main
│   └── configuration/business-config/main
│       └── configuration/business-config/<feature>
├── sales/main
├── purchase/main
├── inventory/main
├── accounts/main
└── hrm/main
```
