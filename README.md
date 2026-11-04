# BridgeOne ERP

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Prisma 7 · PostgreSQL (Neon)

## Getting Started

### 1. Install dependencies
```bash
cd frontend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Fill in `.env`:
- Get `DATABASE_URL` and `DIRECT_URL` from the team's Neon project.
- Generate a fresh RS256 keypair for `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` using the command in `.env.example`.

### 3. Run database migrations
```bash
npm run db:migrate
```

### 4. Seed the database
```bash
npx tsx prisma/seed.ts
```
This creates the company, business units, offices, warehouses, and a default admin user.

### 5. Start the dev server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

Login with the credentials created by the seed script (check `prisma/seed.ts`).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (webpack, no Turbopack) |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript type check |
| `npm run test` | Run all tests |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:generate` | Regenerate Prisma client |

## Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS v4
- **Database**: PostgreSQL via Neon, Prisma 7
- **Auth**: Argon2id password hashing, RS256 JWT in httpOnly cookie
- **Testing**: Vitest + PGlite (in-process Postgres)

## How the modules connect

All modules live in one Next.js app (`frontend/`) and share one PostgreSQL database. A module
is a folder in `src/features/<module>/` with its pages in `src/app/(erp)/<module>/`, its API
in `src/app/api/<module>/`, and its menu in `navigation.ts`. Modules connect in three ways:
shared master data in the database, direct service imports, and the shared platform code in
`src/lib`.

```
                        ┌──────────────────────────────────────────┐
                        │ Configuration (master data + security)    │
                        │ company · business units · offices ·      │
                        │ warehouses · items · customers · suppliers│
                        │ employees · users · permission groups ·   │
                        │ approval pipelines · API tokens · devices │
                        └───────┬──────────┬──────────┬────────┬────┘
                                │          │          │        │
              ┌─────────────────▼─┐   ┌────▼─────┐ ┌──▼─────┐ ┌▼─────────┐
              │ Sales             │◄──┤Production│ │  HRM   │ │ Purchase │
              │ orders, deliveries│   │ BOM,     │ │        │ │          │
              │ returns, bills,   │   │ orders,  │ │        │ │          │
              │ collections       │   │ entries  │ │        │ │          │
              └───┬──────────┬────┘   └────┬─────┘ └───▲────┘ └──────────┘
                  │          │             │           │
                  │   ┌──────▼─────────────▼──┐   ZKTeco agent
                  │   │ Stock ledger           │   (tools/zk-attendance-agent)
                  │   │ (StockEntry table)     │
                  │   └────────────┬───────────┘
                  ▼                ▼
             ┌──────────┐   ┌────────────┐
             │ Accounts │   │ Home       │  reads stock, sales, customers,
             │ (GL)     │──►│ dashboard  │  employees and account balances
             └──────────┘   └────────────┘
```

### Configuration is the hub

Every other module depends on Configuration and nothing in Configuration depends on them
(except the shared document-number generator, `sales/lib/sequence`).

| Configuration provides | Used by |
|---|---|
| Company › business unit › office › warehouse | Scopes almost every record (`businessUnitId`, `officeId`, `warehouseId`) |
| Items, categories, UOMs, opening stock | Sales, Production, Purchase, Home |
| Customers, customer groups, territories, price lists | Sales, Home |
| Suppliers | Purchase, Sales (supplier forms), HRM |
| Employees | HRM (attendance, payroll, leave, governance), Sales persons, Production operators |
| Users, permission groups, overrides | Every API request (see [docs/permissions.md](docs/permissions.md)) |
| Approval pipelines | Production orders |
| API tokens, attendance devices | Integrations and the ZKTeco attendance agent |

### Module-to-module links

| From | To | How |
|---|---|---|
| Sales | Configuration | Item, customer and supplier schemas and forms (`entity-master-data`) |
| Sales | Stock ledger | Deliveries post stock out and returns post stock in (`StockEntry`) |
| Sales | Accounts | Collections reference GL accounts for cash, adjustment and deductions |
| Production | Sales | Reuses sales helpers (`sales/lib`: scope, dates, forms, sequences) and the stock service (`sales/deliveries/services/stock.service`) |
| Production | Stock ledger | Entries consume materials and add finished goods; orders check stock levels |
| Production | Configuration | Item schema; approval pipelines for order approval |
| HRM | Configuration | Employee profile kit and actions; attendance devices and API tokens |
| HRM | Attendance agent | The agent reads the device on the LAN and posts punches with an API token |
| Home | All | `home/overview.service.ts` reads stock, prices, sales targets, customers, suppliers, employees and (for Accounts readers) balances and budgets |

The stock ledger (`StockEntry`) is the main shared table: opening stock, sales deliveries,
returns and production entries all write to it, and stock levels are always computed from
it, so Sales and Production see the same stock.

### Current data sources

| Module | Data |
|---|---|
| Configuration, Sales, Production, HRM, Accounts | PostgreSQL through Prisma (`/api/<module>/…`) |
| Purchase | PostgreSQL through `src/lib/purchase-store`, served at `/api/v1/…` |
| Inventory | Sample data in the browser (`features/inventory/store`); not connected yet |
| POS, RTM, CRM | Planned |

### Shared platform code (`src/lib`)

- `auth/`: sessions (JWT cookie plus `UserSession`), API tokens and `requireActor`.
- `permissions/`: the permission registry built from every module's `navigation.ts`, and the
  API-path → page/action rules. Each module's menu therefore also defines its permissions.
- `api/handler.ts`: `apiHandler(permission, handler)` wraps every route with authentication,
  permission checks and error handling.
- `audit/`: the audit trail written by all modules.
- `navigation/registry.ts`: the sidebar, search and home page list every module's workspace.
- `prisma/`: the single database client.

To add a module: create `src/features/<module>/navigation.ts`, register it in
`src/lib/navigation/registry.ts`, add its API rules in `src/lib/permissions/api-rules.ts`,
and wrap its routes with `apiHandler`.
