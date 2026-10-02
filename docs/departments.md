# Department modules (Operations & Marketing)

The tenant dashboard groups its pages into sidebar departments. **People**,
**Academics**, **Finance** and **System** are hand-written tabs inside
`src/app/dashboard/page.tsx`; **Operations** and **Marketing** are generated
from a single declarative registry instead.

## Pages shipped

| Department | Page | Tab key | API |
|---|---|---|---|
| Operations | Assets & Inventory | `ops-assets` | `/api/operations/assets` |
| Operations | Procurement (requisitions) | `ops-requisitions` | `/api/operations/requisitions` |
| Operations | Maintenance (work orders) | `ops-work-orders` | `/api/operations/work-orders` |
| Operations | Transport & Fleet | `ops-transport` | `/api/operations/transport` |
| Operations | Vendors & Suppliers | `ops-vendors` | `/api/operations/vendors` |
| Marketing | Campaigns | `mkt-campaigns` | `/api/marketing/campaigns` |
| Marketing | Leads & Admission Enquiries | `mkt-leads` | `/api/marketing/leads` |
| Marketing | Announcements | `mkt-announcements` | `/api/marketing/announcements` |
| Marketing | Events & Open Days | `mkt-events` | `/api/marketing/events` |
| Marketing | Referral Programme | `mkt-referrals` | `/api/marketing/referrals` |

## How it fits together

```
src/lib/departments.ts            <- single source of truth (fields, columns, KPIs, statuses)
  ├── src/lib/permissions.ts      <- pages + sections generated into the RBAC matrix
  ├── src/lib/department-api.ts   <- auth + RBAC + validation + audit + tenant scoping
  │     └── src/app/api/{operations,marketing}/[resource]/[[id]]/route.ts
  └── src/app/dashboard/departments/DepartmentWorkspace.tsx
        └── rendered by src/app/dashboard/page.tsx when `activeTab` is a department tab
```

### Guarantees

* **Tenant isolation** — every query is filtered by `session.tenantId`; item
  routes re-verify ownership before update/delete.
* **RBAC on both sides** — the sidebar hides pages a role cannot see *and* the
  API returns `403` for `view/create/edit/delete` the role was not granted.
  Roles with no permission policy keep full access (existing behaviour).
* **Audit trail** — create/update/delete write to `AuditLog` via `logAuditEvent`.
* **Human-readable codes** — `AST-1001`, `REQ-1001`, `WO-1001`, `RTE-1001`,
  `VND-1001`, `CMP-1001`, `LED-1001`, `ANN-1001`, `EVT-1001`, `REF-1001` are
  generated server-side per tenant and are never accepted from the client.

## Adding a new department page

1. Add a tenant-scoped model in `prisma/schema.prisma` (copy any Operations
   model: `tenantId` + cascade delete + `@@unique([tenantId, <code>])`), and add
   the back-relation list on `Tenant`.
2. Add a `DepartmentResourceDef` to `src/lib/departments.ts` and list it in the
   relevant `DEPARTMENTS` entry.
3. Run `npx prisma generate && npx prisma db push`.

That's it — the sidebar entry, the dashboard screen (table, filters, KPI cards,
create/edit modal, delete confirmation, CSV export), the REST endpoints and the
permission matrix checkboxes all come from the config.

To add a whole new department, also create
`src/app/api/<department>/[resource]/route.ts` and `.../[id]/route.ts` (four
lines each, see the Operations files) and add the section key to
`PermSectionKey` / `PERM_SECTIONS` in `src/lib/permissions.ts`.

## Sidebar behaviour

All sidebar groups (People, Academics, Finance, Operations, Marketing, System)
are dropdowns. They are **closed by default**; a group opens when clicked, and
navigation (e.g. global search) auto-opens the group that owns the destination
page. A collapsed group showing a blue dot contains the page you are currently
on.

## Database migration

The ten models are additive — no existing table is touched:

```bash
npx prisma generate
npx prisma db push      # or: npx prisma migrate dev --name departments
```
