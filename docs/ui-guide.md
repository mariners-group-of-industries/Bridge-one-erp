# UI guide — building ERPNext-style screens

BridgeOne follows the ERPNext / Frappe desk look: a sticky navbar with breadcrumbs and
search, a module sidebar, and three kinds of pages. Build every screen from these pieces
so the system feels like one product.

## The desk shell (already done — don't rebuild per page)

`src/app/(erp)/layout.tsx` wraps every page in `AppShell`:

- **Navbar** — logo, breadcrumbs (automatic, from the module registry), awesomebar
  (`Ctrl+K` / `Ctrl+G`), user menu (dark mode, keyboard shortcuts).
- **Sidebar** — all modules; the current module's pages are nested under it.
  `Ctrl+B` hides it. Planned modules show greyed-out with "Soon".
- **Toasts** — `useToast()` works on any page.

## 1. Register your module

Create `src/features/<module>/navigation.ts` and export a `Workspace`
(see `src/features/configuration/navigation.ts`):

```ts
export const sellingWorkspace: Workspace = {
  id: "selling",
  label: "Selling",
  icon: ShoppingCart,           // lucide-react
  href: "/selling",
  description: "Customers, quotations, sales orders and deliveries.",
  status: "active",
  shortcuts: [customers, salesOrders],                 // "Your Shortcuts" tiles
  cards: [{ label: "Masters", links: [customers] }],   // "Reports & Masters" cards
  routes: [                                            // record pages, for breadcrumbs
    { pattern: "/selling/customers/[customerId]", label: "Customer", parent: "/selling/customers" },
  ],
};
```

Then remove the module from `src/lib/navigation/planned.ts` and add it to the
`workspaces` array in `src/lib/navigation/registry.ts`. Sidebar, breadcrumbs, the home page
and the awesomebar pick it up automatically.

## 2. The three page patterns

### Workspace page — `/selling`

```tsx
export default function SellingWorkspacePage() {
  return <WorkspaceView workspace={sellingWorkspace} />;
}
```

### List view — `/selling/customers`

`PageContainer` → `PageHead` (title + primary "Add" action) → `Card` → `DataTable`.
`DataTable` gives search, sort, "Last Updated On", row selection with bulk actions,
20/100/500 page sizes and "Load more". Reference: `BusinessUnitListView.tsx`.

```tsx
<PageContainer>
  <PageHead title="Customers" actions={<Button variant="primary" onClick={…}><Plus /> Add Customer</Button>} />
  <Card>
    <DataTable
      rows={customers}
      columns={COLUMNS}
      getRowId={(c) => c.id}
      getRowLabel={(c) => c.name}
      rowHref={(c) => `/selling/customers/${c.id}`}
      modifiedAt={(c) => c.updatedAt}
      search={{ placeholder: "Search customers", match: (c, q) => c.name.toLowerCase().includes(q) }}
      bulkActions={(rows, done) => [{ label: "Delete", danger: true, onSelect: … }]}
    />
  </Card>
</PageContainer>
```

New records are created in a **quick entry** `Dialog` (only the required fields), then the
user is taken to the full form. Reference: `BusinessUnitQuickEntry.tsx`.

### Form view — `/selling/customers/[customerId]`

`PageHead` with the record name, an `Indicator` ("Not Saved" while `form.dirty`), a "…"
`DropdownMenu` (Reload, Delete) and a primary **Save** button; then a `Card` with `Tabs`;
each tab holds `Section`s with a two-column `FieldGrid`; `RecordMeta` underneath.

- `useValidatedForm(schema, values)` — the same Zod schema as the API; gives `dirty`.
- `useSaveShortcut(save, form.dirty)` — `Ctrl+S` saves.
- Child records go in a grid inside a tab ("No." column, inline rows, "Add Row").
  References: `WarehouseTable.tsx`, `TermsConditionsTable.tsx`.

Reference: `BusinessUnitFormView.tsx`, `OfficeFormView.tsx`.

Dynamic route params are request-time data under Cache Components — read them inside
`<Suspense>` as in `src/app/(erp)/configuration/business-config/offices/[officeId]/page.tsx`.

## Kit reference (`src/components/ui`)

| Component | Use |
| --- | --- |
| `Button`, `buttonClasses()` | `primary` (dark, one per page head), `secondary`, `ghost`, `danger`; sizes `sm`, `md`, `icon` |
| `TextField`, `TextAreaField`, `SelectField`, `CheckboxField`, `Checkbox`, `ReadOnlyField` | Form controls (grey filled, label above) |
| `Card`, `Section`, `FieldGrid` | Form layout |
| `Tabs` | Form tabs + panel |
| `DataTable` | List views |
| `DropdownMenu` | "…" menus, bulk actions |
| `Indicator` | Status pills (`green`, `orange`, `red`, `blue`, `gray` …) |
| `Dialog`, `ConfirmDialog` | Quick entry, confirmations |
| `EmptyState`, `LoadingState`, `ErrorState` | Required states |
| `useToast()` | Success / error alerts |
| `Kbd` | Keyboard hints |

Layout pieces live in `src/components/layout`: `PageContainer`, `PageHead`, `WorkspaceView`,
`RecordMeta`.

## Styling rules

- Use the semantic tokens from `src/app/globals.css`: `bg-canvas` (page), `bg-surface` (cards),
  `bg-control` (inputs/secondary buttons), `border-line`, `text-ink` / `text-ink-muted` /
  `text-ink-faint`, `bg-primary` / `text-primary-fg`, `text-danger`, `text-success`, `text-warning`.
- Body text is 13px (`text-sm`); page titles `text-xl font-semibold`; section titles
  `text-base font-semibold`.
- Check every screen in dark mode (user menu → Toggle dark mode).
