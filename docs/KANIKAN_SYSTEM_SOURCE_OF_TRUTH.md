# KANIKAN System Source Of Truth

Last updated: 2026-05-02
Status: primary release reference for KANIKAN V1

This document replaces scattered blueprint, guide, progress, and wiring notes as the main reference for KANIKAN after the V1 web-app release.

## 1. Product Scope

KANIKAN is an internal fish farm operations system with two main interfaces:

- Bot: fast field input and quick status checks.
- Web-app: dashboard, audit, corrections, pond detail operations, stock ledger, cash ledger, settings, and release-ready maintenance.

The web-app is the main operational workspace for V1. The bot remains useful for fast daily operations.

## 2. V1 Status

V1 is in stabilization/release mode.

Implemented:

- Supabase email/password auth.
- Profile loading with role, language, and Telegram ID.
- Responsive SPA shell.
- Dashboard with KPI, attention preview, and attention page.
- Ponds page with add pond, pond selector, active cycle detail, logs, stock movements, and cycle history.
- Cycle start, close, and transfer backend wiring.
- Daily log edit/delete from pond detail.
- Stock ledger create/delete.
- Cash ledger create/update/delete.
- Settings with language, tutorial mode, dark mode, and Telegram ID.
- Toast notifications and core form validation.
- Bilingual UI direction for Indonesian and English.

Parked for V2:

- Sales CRUD.
- Full reports.
- Master data UI.
- Advanced prediction page.
- AI summary/analysis.

## 3. Folder Structure

Release folder:

```text
D:\PROJECTS\KANIKAN
  bot\
  web-app\
  docs\
  db\
  backups\
```

Folder meaning:

- `bot`: production chatbot source.
- `web-app`: Vite React TypeScript web-app source.
- `docs`: source of truth, user guide, maintenance guide, API notes, release notes.
- `db`: SQL needed to prepare, reset, seed, and test Supabase.
- `backups`: archived old files and release snapshots.

## 4. Architecture

```text
User
  |
  v
React SPA web-app
  |
  +-- Supabase Auth
  |
  +-- TanStack Query cache
  |
  +-- Read RPC / views
  |
  +-- Mutation RPC
        |
        v
     Postgres tables + RLS

Bot
  |
  v
Supabase tables/RPC
```

## 5. Main Tech Stack

Web-app:

- Vite
- React
- TypeScript
- Tailwind CSS
- React Router
- TanStack Query
- Supabase JS
- React Hook Form and Zod where forms need schema validation
- Recharts

Backend:

- Supabase Auth
- Supabase Postgres
- Postgres views and RPC functions
- RLS as the main security layer

Bot:

- Node.js
- Supabase client
- Telegram bot integration

## 6. Data Source Rules

Important rules:

- `stock_movements` is the main stock source.
- `fish_inventory` is legacy only and should not be used for new calculations.
- One pond can have only one active cycle.
- Active cycle means `date_end IS NULL`.
- Live stock is calculated from movement ledger.
- `sold` movement type must only represent sales.
- Transfer must be represented as paired `transfer_out` and `transfer_in` context.
- Manual close must save a reason.
- Personal use should map to `personal_use`; other close corrections map to `adjustment_out`.
- Cash transactions must have positive amount.
- Production data must not contain dummy test rows.

## 7. Core Tables

Main tables:

- `profiles`
- `units`
- `fish_types`
- `cycles`
- `log_harian`
- `stock_movements`
- `penjualan`
- `kas`
- `kas_categories`

V1 web-app actively uses:

- `profiles`
- `units`
- `fish_types`
- `cycles`
- `log_harian`
- `stock_movements`
- `kas`
- `kas_categories`

Sales remains parked for V2 even though the table may exist.

## 8. Required SQL Run Order

For an existing Supabase project:

```text
1. db/01_schema_cleanup_v1_2026_04_28.sql
2. db/02_api_read_rpc_v1.sql
3. db/03_api_mutation_rpc_v1.sql
4. db/04_production_reset_seed_v1.sql
```

For development/testing dummy data:

```text
1. db/01_schema_cleanup_v1_2026_04_28.sql
2. db/02_api_read_rpc_v1.sql
3. db/03_api_mutation_rpc_v1.sql
4. db/05_development_dummy_seed_v1.sql
```

Do not run production reset and dummy seed on the same production database.

## 9. Permissions

Role direction:

- `owner`: full operational access, including edit/delete.
- `member`: limited operational access. RLS must remain the final enforcement layer.

The UI may hide actions, but security must not depend only on UI hiding.

## 10. Harvest Estimation

V1 can estimate harvest in the pond detail page when there are:

- target weight
- current average weight
- at least two sample-weight logs

Formula:

```text
days_left = ceil((target_weight_g - avg_weight_g) / recent_growth_g_per_day)
```

If the backend RPC already returns numeric `days_left`, the web-app can use it. If not, the web-app uses its frontend fallback.

## 11. Release Checklist

Before release:

- Build web-app with `npm.cmd run build`.
- Run production SQL in the correct order.
- Login with real Supabase user.
- Verify owner profile role.
- Test add pond.
- Test start cycle.
- Test add/edit/delete daily log.
- Test stock movement create/delete.
- Test close cycle with danger confirmation.
- Test transfer cycle.
- Test cash create/update/delete.
- Test language switch persists across pages.
- Test mobile layout for modals and ledgers.

## 12. Backup Rule

Before any risky database or file operation:

- Export/backup database from Supabase if the DB contains important data.
- Copy current project files into `backups`.
- Never run dummy seed on production.
- Never reset production data unless the release goal explicitly requires a clean production database.

