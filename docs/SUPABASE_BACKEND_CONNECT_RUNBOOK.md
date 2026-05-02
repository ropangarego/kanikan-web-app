# Supabase Backend Connect Runbook

This runbook explains how to run the database cleanup, install the V1 read RPC backend, and connect it to the frontend.

## Files To Run

Run these files from the Supabase dashboard:

```text
kanikan-web/supabase/schema_cleanup_v1_2026_04_28.sql
kanikan-web/supabase/api_read_rpc_v1.sql
```

## Step 1 - Backup First

Before running migrations, create a backup from Supabase:

```text
Supabase Dashboard
  -> Project
  -> Database
  -> Backups
```

If your project does not have automated backups, export the schema/data manually from Supabase before continuing.

## Step 2 - Run Schema Cleanup

Open:

```text
Supabase Dashboard
  -> SQL Editor
  -> New Query
```

Paste and run:

```text
kanikan-web/supabase/schema_cleanup_v1_2026_04_28.sql
```

This migration:

- renames/merges `notes` into `description`
- removes `log_harian.water_condition`
- backfills `fish_inventory` into `stock_movements`
- drops legacy `fish_inventory`
- normalizes `kas.category` into `kas.category_id`
- adds `kas.source_sale_id`
- adds indexes and safety constraints

## Step 3 - Run Verification Query

After cleanup, run the verification query at the bottom of:

```text
kanikan-web/supabase/schema_cleanup_v1_2026_04_28.sql
```

Expected result:

```text
fish_inventory_removed        true
legacy_columns_removed        true
kas_category_id_complete      true
one_active_cycle_guard_exists true
```

If any value is false, stop before installing the API RPC layer.

## Step 4 - Install Read API RPC

In Supabase SQL Editor, paste and run:

```text
kanikan-web/supabase/api_read_rpc_v1.sql
```

This creates:

- `api_v_*` helper views
- `api_dashboard_summary`
- `api_ponds_list`
- `api_pond_detail`
- `api_stock_movements`
- `api_cash_summary`
- `api_cash_transactions`
- `api_cash_categories`
- `api_form_options`
- `api_profile_me`

## Step 5 - Smoke Test RPCs

Run these from Supabase SQL Editor while logged into the project:

```sql
select public.api_cash_categories(null);
select public.api_ponds_list(true, null);
select public.api_dashboard_summary(current_date, null, null);
select public.api_stock_movements('30d', null, null, 'all', 'all', 10, null);
select public.api_cash_summary(to_char(current_date, 'YYYY-MM'));
select public.api_cash_transactions(to_char(current_date, 'YYYY-MM'), null, null, 10, null);
```

Expected behavior:

- each query returns one JSON object
- arrays return `[]`, not `null`
- `can_delete` appears in stock/cash/log ledger responses

## Step 6 - Confirm Frontend Env

The frontend needs:

```text
kanikan-web/.env
```

with:

```text
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Never put the service role key in the frontend.

## Step 7 - Run Frontend

From the project folder:

```powershell
cd "C:\Users\rpang\OneDrive\Documents\New project\kanikan-web"
npm.cmd run dev
```

Then open the local Vite URL, usually:

```text
http://localhost:5173
```

Login with a real Supabase Auth user.

## Step 8 - Check Pages

Check these pages first:

```text
Dashboard
Stock
Cash
Ponds
Settings
```

Current frontend behavior:

```text
If RPC succeeds:
  page displays backend data

If RPC fails:
  page falls back to local AppDataContext data
```

For debugging, open browser DevTools:

```text
Network tab
  -> look for Supabase rpc calls
Console tab
  -> look for function/schema errors
```

## Step 9 - Next Backend Work

After reads are stable, build mutation RPCs:

```text
api_daily_log_create/update/delete
api_stock_movement_create/delete
api_cash_transaction_create/delete
api_profile_update
api_cycle_start/close/transfer
```

After mutation RPCs exist, the frontend CRUD buttons can stop using local fallback writes.
