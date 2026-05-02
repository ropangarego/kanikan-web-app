# KANIKAN Web App Progress Tracker

Last updated: 2026-04-28

This file tracks the V1 web-app implementation after Supabase read wiring and core mutation RPC wiring.

## Overall status

Current status:

- V1 app shell, routing, auth, and responsive layout are implemented.
- Supabase read API/RPC is wired for dashboard, ponds, stock, cash, and settings.
- Core Supabase mutation RPCs are prepared for ponds, daily logs, stock movements, cash, profile, and cycle operations.
- Pond Detail is the main V1 operational workspace.
- Sales is intentionally parked for V2.
- Standalone Daily Logs, Sales, and Cycles pages no longer run local-only operational CRUD.

Progress estimate:

```text
Product spec / UX direction       [##########] 100%
Frontend shell / routing          [##########] 100%
Responsive UI polish              [########--] 80%
Supabase auth + profile           [#########-] 90%
Read API / views / RPC            [#########-] 95%
Mutation RPC SQL                  [########--] 85%
Dashboard                         [#########-] 90%
Ponds + pond detail operations    [#########-] 90%
Stock movements                   [########--] 85%
Cash ledger                       [#########-] 90%
Notifications + validation        [########--] 85%
Manual E2E QA                     [######----] 60%
V1 production hardening           [#######---] 70%
```

Overall V1 estimate: about 88-92% complete, depending on Supabase SQL/RLS verification and manual testing results.

## What is done

### Foundation

- Vite + React + TypeScript
- Tailwind CSS
- React Router
- TanStack Query
- Supabase client
- `.env` based Supabase connection
- Domain-oriented feature folders

### Auth and profile

- Real Supabase email/password login
- Protected app routes
- Profile read from Supabase
- Settings can update language and Telegram ID through mutation RPC
- UI role gating is present where relevant

### Read API

- Read contracts live under `src/lib/api`
- Dashboard uses Supabase-backed summary data
- Pond list/detail uses Supabase-backed data
- Stock movements use Supabase-backed data
- Cash ledger uses Supabase-backed data
- Form pond options are fetched from DB instead of static local values

### Mutation API

Mutation clients are implemented in `src/lib/api/mutations.ts`.

Server RPC definitions are prepared in:

```text
supabase/api_mutation_rpc_v1.sql
```

Covered mutation flows:

- create/update/delete daily log
- create/delete stock movement
- create/update/delete cash transaction
- create pond
- update profile
- start cycle
- close cycle
- transfer cycle

### V1 pages

- Dashboard: KPI cards, attention preview, link to full Attention page
- Attention: full critical/todo list
- Ponds: DB-backed list, pond selector, and owner-only add pond flow
- Pond Detail: active cycle view, tabs, add log, update stock, transfer, close cycle, cycle history context
- Stock Movements: DB-backed ledger with create/delete
- Cash: DB-backed ledger with create/update/delete
- Settings: profile preferences
- Daily Logs: guidance page pointing to Pond Detail
- Cycles: guidance page pointing to Pond Detail
- Sales: V2 placeholder

### UX fixes

- Dashboard attention preview capped
- Attention page added
- Tooltip removed from feed KPI
- Dynamic pond dropdowns
- Loading states added around pond switching
- Empty states normalized
- Actions hidden or limited based on access
- Date picker width constrained for mobile
- Login email clear button and password visibility toggle
- Toast notifications for save/update/delete/failure flows
- Form validation added to core V1 operational forms
- Close cycle uses danger confirmation
- Cash ledger sorted oldest to newest

## Source of truth

Product/spec source of truth:

```text
KANIKAN_WEB_APP_SPEC_FINAL.md
```

API/read contract:

```text
docs/API_CONTRACT_V1.md
docs/API_RPC_DESIGN_V1.md
```

Mutation RPC source:

```text
supabase/api_mutation_rpc_v1.sql
```

## Current architecture

```text
User
  |
  v
React SPA
  |
  +--> Supabase Auth
  |
  +--> TanStack Query
  |      |
  |      +--> Read views/RPC
  |      +--> Tables for simple reads where appropriate
  |
  +--> Mutation API
         |
         +--> Supabase RPC
                |
                +--> Tables
                +--> Business rules
                +--> RLS
```

Local storage is used only for draft/filter/UI preference style data, not as the production source of truth.

## SQL run order

Run these in the Supabase SQL Editor for the connected project:

```text
1. supabase/schema_cleanup_v1_2026_04_28.sql
2. supabase/api_read_rpc_v1.sql
3. supabase/api_mutation_rpc_v1.sql
```

After that:

```text
1. Restart the Vite dev server if it is running.
2. Login with a real Supabase user.
3. Test Pond Detail flows first.
4. Test Stock Movements.
5. Test Cash.
6. Test Settings.
```

## V1 testing checklist

- Login/logout works with real Supabase email/password.
- Dashboard summary loads without local fallback confusion.
- Attention preview shows only a small preview, while Attention page shows all items.
- Pond selector shows all DB ponds, sorted active first.
- Owner can add a pond from the Ponds page title and the new pond appears after refresh.
- Inactive pond detail does not show active-cycle-only metrics.
- Start cycle creates an active cycle.
- Add log saves to DB and appears in Pond Detail.
- Edit/delete log updates DB.
- Update stock creates stock movement.
- Delete stock movement removes DB row when allowed.
- Transfer cycle creates paired transfer context and closes source cycle.
- Close cycle requires confirmation and reason.
- Cash create/update/delete works.
- Negative cash amount is blocked.
- Mobile date fields stay inside screen width.
- Toasts appear for success and failure states.
- RLS blocks actions for users who should not mutate data.

## Remaining V1 stabilization

- Run the mutation RPC SQL against Supabase and verify permissions.
- Manual E2E test with owner and member accounts.
- Confirm RLS policies match UI access rules.
- Confirm old data still displays correctly after cleanup migration.
- Add pagination/windowing if ledgers become large.
- Add backup/restore notes for production operations.
- Do one mobile browser pass for layout issues.

## Parked for V2

- Sales CRUD and sale-to-cash integration
- Reports
- Master Data management
- Prediction improvements
- Optional AI summary/analysis layer
