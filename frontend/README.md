# BridgeOne ERP — Frontend & API

Next.js 16 (App Router) + TypeScript, Prisma 7 on Neon PostgreSQL, Zod validation, Tailwind CSS 4.

## Setup

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env        # fill in Neon DATABASE_URL (pooled) and DIRECT_URL (direct)
npm run db:deploy           # apply migrations (use `npm run db:migrate` while developing schema changes)
npm run dev
```

Open <http://localhost:3000/configuration/business-config/company-profile>.

> **Authentication is not implemented yet.** All `/api/configuration/*` endpoints return
> `401` unless `ERP_DEV_AUTH_BYPASS=true` is set in a non-production environment.
> Integrate a real provider in `src/lib/auth/actor.ts` before production use.

### Local database without Neon

`npx prisma dev -n bridgeone-erp -d` starts a local Postgres-compatible server and prints its
URL; use it for both `DATABASE_URL` and `DIRECT_URL`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | Generate route types and run `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest (services + route handlers against in-process PGlite with the real migrations) |
| `npm run db:validate` / `db:generate` / `db:migrate` / `db:deploy` | Prisma |

## Structure

```text
prisma/                         schema.prisma + migrations
src/app/configuration/...       pages
src/app/api/configuration/...   REST route handlers (thin: auth → validate → service)
src/features/<module>/<area>/<feature>/
  components/  hooks/  services/ (browser API client)  schemas/ (Zod, shared)  server/ (business logic + Prisma)  types/
src/components/ui/              reusable UI primitives
src/lib/                        prisma client, API error handling, auth seam, object storage, validation helpers
tests/                          Vitest suites
```

## Company Profile API

All responses use `{ "data": ... }` or `{ "error": { "code", "message", "fieldErrors?" } }`.

| Method & path | Description |
| --- | --- |
| `GET/PUT /api/configuration/company` | Read / create-or-update the company profile |
| `GET/POST /api/configuration/business-units` | List / create business units |
| `PUT/DELETE /api/configuration/business-units/:id` | Update / delete (409 `IN_USE` while offices exist) |
| `GET/POST /api/configuration/business-units/:id/offices` | List / create offices |
| `GET/PUT/DELETE /api/configuration/offices/:id` | Office details / update / delete (409 while warehouses exist) |
| `GET/POST /api/configuration/offices/:id/warehouses` | List / create warehouses |
| `PUT/DELETE /api/configuration/warehouses/:id` | Update / delete warehouse |
| `GET/PUT/DELETE /api/configuration/offices/:id/assets/:kind` | Serve / upload-or-replace (multipart `file`) / remove; `kind` = `brand-logo`, `header`, `footer` |
| `GET /api/configuration/business-units/:id/terms?domain=SALES\|PURCHASE` | List terms in display order |
| `POST /api/configuration/business-units/:id/terms` | Create term |
| `PATCH/DELETE /api/configuration/terms/:id` | Update content / default / applicable document types; delete |
| `PUT /api/configuration/business-units/:id/terms/order` | Persist display order `{ domain, orderedIds }` |

Branding files: PNG, JPEG or WebP up to 2 MB, verified by file signature. Binaries are stored via
`src/lib/storage` (currently a local-disk driver); only metadata and the storage key are kept in
PostgreSQL. Serverless hosts do not persist local disk, so add an S3-compatible driver before
deploying to such platforms.
