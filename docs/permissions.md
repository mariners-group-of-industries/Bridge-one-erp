# Permissions (RBAC)

Who can sign in, and what each signed-in user may see and do.

## How access is decided

For every API request from a signed-in user (`apiHandler` → `requireActor`):

1. The session is looked up together with the user's **ERP Access**, **Status**, permission groups and
   individual overrides, so a change applies from the user's next request, including open sessions.
   Accounts without ERP access, suspended or inactive accounts get **401** (signed out).
2. **Master accounts** may do everything and are never locked out.
3. The request's page and action are worked out from its path and method
   (`src/lib/permissions/api-rules.ts`), and the user's **effective permissions** must include them:
   1. an individual **Deny** blocks,
   2. an individual **Allow** grants,
   3. otherwise the union of the user's **active** groups,
   4. otherwise denied.
4. Missing permission → **403** with `details.required = { feature, action }`.

API tokens keep their access level: Read & write tokens may do everything, read-only tokens may only view
and export.

## The registry

`src/lib/permissions/registry.ts` is the single list of modules, submodules (menu cards) and pages, built
from each module's `navigation.ts`. Each page gets **View, Create, Edit, Delete and Export** unless
`FEATURE_ACTIONS` gives it other actions (reports: View and Export; approval documents: + Approve;
master data: + Import; Permission Group: + Assign and **Manage Permissions**).

Permission keys are stable and derived from the page path: `/sales/orders` → `sales.orders.view`,
`sales.orders.delete` and so on. The matrix, `/api/auth/me`, the menus and the server all use them.

## Adding a feature

1. Register the page in the module's `navigation.ts` (it then appears in the matrix with the default
   actions). Add it to `FEATURE_ACTIONS` only when it needs other actions.
2. If its API path starts with the page path (`/api/sales/orders/…` for `/sales/orders`), nothing else
   is needed. Otherwise add an entry to `API_RULES`. Shared lookups use `read: { anyViewIn: [...] }`.
3. `tests/api-auth.test.ts` fails when a route has no mapping, or answers without a session.
4. In the UI, hide buttons with `useSession().can(page, action)`. Hiding is a convenience: the server
   checks every request.

## Administration

- **Configuration › Identity & Security › Permission Group**: create, edit, duplicate, activate or
  deactivate groups, assign users. Groups that still have users cannot be deleted.
- **Employee › Personal Info › ERP Access & Permissions** (needs *Manage Permissions*): ERP Access, Account
  Status, Master Administrator (master only), Permission Groups, Individual Permissions
  (Inherit / Allow / Deny) and Effective Permissions (preview, including unsaved changes).
- Nobody can change their own access. Only the master account can change master accounts, make new
  ones, or assign full-access groups. Everyone else can only grant permissions they hold themselves.
- Every change is written to `permission_audit_logs` with the values before and after, the IP address
  and the browser.

## Rollout

The migration `20261104000000_rbac_permissions`:

- turns **ERP Access on** for every existing account (new accounts start with it off);
- creates the **Legacy Full Access** group (code `LEGACY_FULL_ACCESS`, full access) and assigns it to every
  existing non-master user, so nobody loses access on deploy.

Afterwards, create real groups, assign them to each user, then take the user out of Legacy Full Access.
New logins created under Employee › ERP Login start **without** ERP access and permissions; turn ERP
Access on and assign groups in the same section.

Deploy: `npm run db:deploy` (with `DIRECT_URL` set to the production database), then deploy the app.
