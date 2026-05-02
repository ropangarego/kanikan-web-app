# KANIKAN Developer Maintenance Guide

Last updated: 2026-05-02
Audience: future maintainer or developer

## 1. Project Layout

Release folder:

```text
D:\PROJECTS\KANIKAN
  bot\
  web-app\
  docs\
  db\
  backups\
```

Web-app folder:

```text
web-app\
  src\
    features\
    lib\
    routes\
    types\
  docs\
  supabase\
  public\
```

## 2. Web-App Setup

From `D:\PROJECTS\KANIKAN\web-app`:

```powershell
npm install
npm.cmd run build
```

Development server:

```powershell
npm.cmd run dev
```

Environment file:

```text
.env
```

Required variables:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Do not commit or share real production secrets publicly.

## 3. Database Setup

SQL files live in:

```text
D:\PROJECTS\KANIKAN\db
```

Recommended production order:

```text
1. 01_schema_cleanup_v1_2026_04_28.sql
2. 02_api_read_rpc_v1.sql
3. 03_api_mutation_rpc_v1.sql
4. 04_production_reset_seed_v1.sql
```

Recommended development order:

```text
1. 01_schema_cleanup_v1_2026_04_28.sql
2. 02_api_read_rpc_v1.sql
3. 03_api_mutation_rpc_v1.sql
4. 05_development_dummy_seed_v1.sql
```

Run SQL through Supabase SQL Editor unless a proper migration runner is added later.

## 4. API Layer

Frontend API code lives under:

```text
src/lib/api
```

Pattern:

- Query functions read RPC/view responses.
- Mutation functions call mutation RPCs.
- TanStack Query owns caching and invalidation.
- UI should not calculate heavy aggregates from raw rows when RPC can provide a summary.

## 5. Important Business Rules

Keep these rules intact:

- One active cycle per pond.
- Active cycle means `date_end IS NULL`.
- `stock_movements` is the main stock ledger.
- Cash amount must be positive.
- Close cycle requires reason.
- Transfer should remain traceable.
- Owner can edit/delete operational records where RLS allows it.
- UI role gating is secondary; RLS is primary.

## 6. Bilingual UI

Text lives in:

```text
src/lib/i18n.ts
```

When adding a new label:

1. Add Indonesian key.
2. Add English key.
3. Use `translate(language, key)` or the local `t()` helper.
4. Avoid hardcoded UI strings inside components.

## 7. Toasts and Feedback

Use the toast provider for:

- save success
- update success
- delete success
- validation failure
- network/API failure

Do not silently fail.

## 8. Forms

Forms should:

- Validate required fields.
- Block negative numbers where invalid.
- Show clear error messages.
- Reset draft state after successful create/cancel.
- Use fixed-width responsive date inputs.

## 9. Release Verification

Before release:

```powershell
npm.cmd run build
```

Then manually test:

- Login/logout.
- Language switch.
- Add pond.
- Start cycle.
- Add/edit/delete daily log.
- Add/delete stock movement.
- Transfer cycle.
- Close cycle.
- Cash add/edit/delete.
- Mobile layout.

## 10. Backup and Rollback

Before risky changes:

- Copy project files into `backups`.
- Export Supabase database if production has important data.
- Keep the previous SQL files.
- Avoid destructive SQL unless the release plan explicitly requires reset.

Rollback idea:

```text
1. Restore database backup in Supabase.
2. Restore previous web-app folder from backups.
3. Rebuild web-app.
4. Retest login and dashboard.
```

## 11. Known V2 Items

Parked for later:

- Sales CRUD.
- Reports.
- Master Data UI.
- Prediction page improvements.
- AI summary/analysis.
- Full migration runner instead of manual Supabase SQL Editor.

