# KANIKAN API/RPC Design V1

This document defines the backend API/RPC layer required by the current frontend. It is designed for Supabase/Postgres RPCs returning JSON payloads that match the UI directly.

The goal is simple: the frontend should not reconstruct business state from raw tables. Backend views/RPCs own aggregation, joins, validation, and derived labels.

## Scope

V1 covers:

- Dashboard reads
- Ponds list/detail reads
- Daily log CRUD
- Stock movements reads/CRUD
- Cash summary/transactions/categories reads
- Cash transaction CRUD
- Settings/profile reads/update
- Form option reads
- Pond/cycle operational actions

Out of V1 unless explicitly added later:

- Complex role management UI
- Full sales management redesign
- AI/prediction writes
- Multi-farm tenancy beyond existing profile/session assumptions

## Naming Rules

- RPC functions are prefixed with `api_`.
- Read RPCs return one JSON object.
- Mutation RPCs return the changed record or a compact success object.
- Database helper views are prefixed with `api_v_`.
- All frontend-facing JSON uses `snake_case`.
- All RPC params are prefixed with `p_`.

## Auth And Security Rules

- All RPCs require an authenticated Supabase user.
- RLS should remain enabled on base tables.
- RPCs should be `SECURITY DEFINER` only when needed, with locked `search_path = public`.
- Mutation RPCs must validate ownership/role before writing.
- Owner can perform all V1 actions.
- Member can add daily logs, update stock, and add cash transactions only if allowed by product policy.
- Delete actions should be soft-restricted by source:
  - Manual UI records can be deleted.
  - Bot/import/sale-generated records should either be blocked or require a stronger admin flow.

Recommended returned error format:

```json
{
  "ok": false,
  "code": "NO_ACTIVE_CYCLE",
  "message": "Selected pond does not have a running cycle."
}
```

## Core Database Objects Assumed

From the current cleaned schema:

- `profiles`
- `units`
- `cycles`
- `log_harian`
- `stock_movements`
- `kas`
- `kas_categories`
- `penjualan`
- `fish_types`

Clean schema expectations:

- Use `description`, not `notes`.
- `log_harian.water_condition` is removed.
- `kas.category_id` references `kas_categories.id`.
- `penjualan.total_rp` is generated and should not be manually written.
- There is max one active cycle per unit via partial unique index.

## Shared Types

```ts
type CashType = 'Masuk' | 'Keluar'
type PondStatus = 'active' | 'inactive'
type CycleStatus = 'running' | 'closed'
type StockMovementType =
  | 'stock_in'
  | 'sold'
  | 'died'
  | 'transfer_in'
  | 'transfer_out'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'personal_use'
type StockFilterType = 'all' | 'in' | 'sold' | 'died' | 'transfer'
type PeriodFilter = 'today' | '7d' | '30d' | 'month' | '3m' | 'all'
```

## Required Views

These views keep RPCs readable and prevent duplicated logic.

### `api_v_current_cycles`

Purpose: one row per currently running cycle.

Columns:

- `cycle_id`
- `cycle_name`
- `unit_id`
- `unit_name`
- `fish_type_id`
- `fish_species`
- `date_start`
- `date_end`
- `initial_stock`
- `target_weight_g`
- `avg_seed_weight_g`
- `capital_rp`
- `description`
- `days_since_stocking`

Logic:

- `date_end IS NULL`
- Join `units`
- Join `fish_types`

### `api_v_cycle_stock_totals`

Purpose: authoritative live stock per cycle.

Columns:

- `cycle_id`
- `stock_in_count`
- `sold_count`
- `died_count`
- `transfer_in_count`
- `transfer_out_count`
- `adjustment_in_count`
- `adjustment_out_count`
- `personal_use_count`
- `live_fish_count`

Movement sign rules:

- In: `stock_in`, `transfer_in`, `adjustment_in`
- Out: `sold`, `died`, `transfer_out`, `adjustment_out`, `personal_use`

### `api_v_latest_log_per_cycle`

Purpose: last log display and stale log checks.

Columns:

- `cycle_id`
- `unit_id`
- `log_id`
- `date`
- `created_at`
- `feed_g`
- `sample_weight_g`
- `sample_count`
- `description`

Order:

- `date DESC`
- `created_at DESC`

### `api_v_latest_weight_per_cycle`

Purpose: avg weight display.

Columns:

- `cycle_id`
- `sample_weight_g`
- `sample_count`
- `date`
- `created_at`

Filter:

- `sample_weight_g IS NOT NULL`

### `api_v_pond_cards`

Purpose: stock page pond cards and pond selector.

Columns:

- `pond_id`
- `pond_name`
- `pond_type`
- `capacity_fish`
- `pond_status`
- `description`
- `cycle_id`
- `cycle_name`
- `fish_type_id`
- `fish_species`
- `date_start`
- `days_since_stocking`
- `live_fish_count`
- `survival_rate_pct`
- `avg_weight_g`
- `target_weight_g`
- `biomass_kg`

### `api_v_stock_movements_enriched`

Purpose: stock ledger without frontend joins.

Columns:

- `movement_id`
- `date`
- `unit_id`
- `pond_name`
- `cycle_id`
- `cycle_name`
- `fish_type_id`
- `fish_species`
- `movement_type`
- `movement_label`
- `direction`
- `count`
- `weight_kg`
- `description`
- `source_table`
- `source_row_id`
- `can_delete`
- `created_by`
- `created_by_name`
- `created_at`

`can_delete` rule:

- `true` when `source_table = 'manual_ui' OR source_table IS NULL`
- `false` for sale-generated, bot-transfer, or imported records unless owner override is later added.

### `api_v_cash_transactions_enriched`

Purpose: cash ledger display.

Columns:

- `transaction_id`
- `date`
- `type`
- `category_id`
- `category_name`
- `description`
- `amount_rp`
- `cycle_id`
- `source_sale_id`
- `can_delete`
- `created_by`
- `created_by_name`
- `created_at`

`can_delete` rule:

- `false` when `source_sale_id IS NOT NULL`
- `true` for manual UI cash entries.

### `api_v_daily_logs_enriched`

Purpose: pond daily logs and future log ledger.

Columns:

- `log_id`
- `date`
- `unit_id`
- `pond_name`
- `cycle_id`
- `cycle_name`
- `fish_type_id`
- `fish_species`
- `feed_g`
- `event`
- `action`
- `description`
- `sample_weight_g`
- `sample_count`
- `created_by`
- `created_by_name`
- `created_at`
- `can_delete`
- `can_update`

V1 `can_delete/can_update`:

- `true` for authenticated owner.
- For member, true only when created by current profile if product policy allows.

### `api_v_cash_daily_balance`

Purpose: balance line chart.

Columns:

- `date`
- `income_rp`
- `outcome_rp`
- `net_rp`
- `daily_balance_delta_rp`

RPC still computes opening/ending balance for selected month.

## Read RPCs

### 1. `api_dashboard_summary`

Signature:

```sql
api_dashboard_summary(
  p_date date default current_date,
  p_period_start date default null,
  p_period_end date default null
) returns jsonb
```

Used by:

- Dashboard page

Must return:

- KPI row
- Attention items
- Overall growth points
- Money snapshot
- Active pond overview only

Important calculations:

- `running_ponds`: count active cycles.
- `feed_today_g`: sum `log_harian.feed_g` where `date = p_date`.
- `feed_target_g`: average daily feed over selected period.
- `feed_today_vs_target_pct`: `feed_today_g / feed_target_g * 100`, null-safe.
- `survival_rate_pct`: sum live fish / sum initial stock for running cycles.
- `mortality_this_week_pct`: died count in selected period / (live fish + died count).
- `growth.points`: average sample weight per date across running cycles.
- `pond_overview`: only ponds with running cycles.

Response shape:

Use `DashboardSummaryResponse` in `src/types/api-contract.ts`.

### 2. `api_ponds_list`

Signature:

```sql
api_ponds_list(
  p_include_inactive boolean default true,
  p_q text default null
) returns jsonb
```

Used by:

- Ponds page selector
- Mobile selected pond/change pond
- Form options if separate options RPC is not used

Must return:

- `summary`
- `ponds[]`

Rules:

- Include inactive ponds only when requested.
- Search by `units.name ILIKE`.
- Include current cycle object if running cycle exists.

### 3. `api_pond_detail`

Signature:

```sql
api_pond_detail(
  p_pond_id uuid,
  p_logs_limit integer default 30,
  p_stock_limit integer default 30
) returns jsonb
```

Used by:

- Ponds page detail tab

Must return:

- `pond`
- `current_cycle`
- `daily_logs`
- `stock_movements`
- `cycle_history`

Rules:

- If no running cycle, `current_cycle = null`.
- Daily logs should be newest first.
- Stock movements should be newest first.
- Cycle history should be newest first.
- `current_cycle.last_log` should use latest log by date/created_at.
- Harvest prediction can be `N/A` if insufficient growth data.

### 4. `api_stock_movements`

Signature:

```sql
api_stock_movements(
  p_period text default '30d',
  p_start_date date default null,
  p_end_date date default null,
  p_pond_id text default 'all',
  p_type text default 'all',
  p_limit integer default 50,
  p_cursor text default null
) returns jsonb
```

Used by:

- Stock page

Must return:

- `period`
- `pond_cards`
- `filters`
- `items`
- `next_cursor`

Filter rules:

- `p_pond_id = 'all'` means no pond filter.
- `type = in` maps to `stock_in`.
- `type = transfer` maps to `transfer_in`, `transfer_out`.
- Cursor should be stable, preferably encoded from `(date, created_at, movement_id)`.

### 5. `api_cash_summary`

Signature:

```sql
api_cash_summary(
  p_month text
) returns jsonb
```

Used by:

- Cash & Balance top section

Must return:

- month period
- opening balance
- income
- outcome
- net
- ending balance
- balance points

Rules:

- `p_month` format: `YYYY-MM`.
- Opening balance is sum before month start.
- Ending balance is opening + month net.
- Balance points are per date in selected month.

### 6. `api_cash_transactions`

Signature:

```sql
api_cash_transactions(
  p_month text,
  p_type text default null,
  p_category_id uuid default null,
  p_limit integer default 50,
  p_cursor text default null
) returns jsonb
```

Used by:

- Cash ledger

Must return:

- `items`
- `next_cursor`

Rules:

- Month source of truth is Cash page month control.
- Join `kas_categories`.
- Newest first.
- `can_delete = false` when linked to sale.

### 7. `api_cash_categories`

Signature:

```sql
api_cash_categories(
  p_type text default null
) returns jsonb
```

Used by:

- Add Transaction modal
- Cash ledger category display

Rules:

- Sort by `sort_order`, then `name`.
- If `p_type` is null, return all.

### 8. `api_form_options`

Signature:

```sql
api_form_options() returns jsonb
```

Used by:

- Quick action modals
- Add/update stock form
- Add daily log form
- Add transaction form

Must return:

```json
{
  "active_ponds": [
    {
      "pond_id": "uuid",
      "pond_name": "Bucket 1",
      "cycle_id": "uuid",
      "cycle_name": "Cycle 101",
      "fish_type_id": "uuid",
      "fish_species": "Lele"
    }
  ],
  "all_ponds": [
    {
      "pond_id": "uuid",
      "pond_name": "Bucket 1",
      "status": "active"
    }
  ],
  "fish_types": [
    {
      "fish_type_id": "uuid",
      "name": "Lele"
    }
  ],
  "cash_categories": [
    {
      "category_id": "uuid",
      "type": "Keluar",
      "name": "Pakan",
      "sort_order": 1
    }
  ]
}
```

### 9. `api_profile_me`

Signature:

```sql
api_profile_me() returns jsonb
```

Used by:

- Settings page

Must return:

```json
{
  "profile_id": "uuid",
  "full_name": "R Pang",
  "email": "owner@kanikan.local",
  "role": "owner",
  "language": "id",
  "telegram_id": "123456789"
}
```

## Mutation RPCs

All mutation RPCs should return:

```json
{
  "ok": true,
  "item": {}
}
```

or raise/return a structured error.

### 1. `api_daily_log_create`

Signature:

```sql
api_daily_log_create(
  p_date date,
  p_unit_id uuid,
  p_feed_g numeric,
  p_event text default '',
  p_action text default '',
  p_description text default '',
  p_sample_weight_g numeric default null,
  p_sample_count integer default null
) returns jsonb
```

Backend derives:

- running `cycle_id` from `p_unit_id`
- `fish_type_id` from running cycle
- `created_by` from auth profile

Validation:

- unit must have running cycle.
- feed/sample values must be non-negative.

### 2. `api_daily_log_update`

Signature:

```sql
api_daily_log_update(
  p_log_id uuid,
  p_date date,
  p_feed_g numeric,
  p_event text default '',
  p_action text default '',
  p_description text default '',
  p_sample_weight_g numeric default null,
  p_sample_count integer default null
) returns jsonb
```

Rules:

- Do not allow changing `unit_id/cycle_id` in V1 edit.
- Validate ownership/role.

### 3. `api_daily_log_delete`

Signature:

```sql
api_daily_log_delete(
  p_log_id uuid
) returns jsonb
```

Rules:

- Hard delete is acceptable in V1 only if audit is not required.
- Prefer soft delete later if operations need history.

### 4. `api_stock_movement_create`

Signature:

```sql
api_stock_movement_create(
  p_date date,
  p_unit_id uuid,
  p_movement_type text,
  p_count integer,
  p_weight_kg numeric default null,
  p_description text default '',
  p_to_unit_id uuid default null
) returns jsonb
```

Backend derives:

- source running cycle from `p_unit_id`
- source fish type from source cycle

Transfer behavior:

- If `p_movement_type = 'transfer_out'` or UI type is transfer:
  - Require `p_to_unit_id`.
  - Require target pond has running cycle if transferring fish into existing cycle.
  - Create paired `transfer_out` and `transfer_in` rows in one transaction.

Validation:

- source pond must have running cycle.
- count must be positive.
- movement type must be valid.
- outgoing movements cannot make live stock negative unless owner override is later added.

### 5. `api_stock_movement_delete`

Signature:

```sql
api_stock_movement_delete(
  p_movement_id uuid
) returns jsonb
```

Rules:

- Allow delete only when `can_delete = true`.
- If movement is paired transfer, decide V1 policy:
  - Recommended: delete both paired transfer rows using shared metadata pair ID.
  - If no pair ID exists yet, block deletion for transfer rows.

### 6. `api_cash_transaction_create`

Signature:

```sql
api_cash_transaction_create(
  p_date date,
  p_type text,
  p_category_id uuid,
  p_amount_rp integer,
  p_description text default '',
  p_cycle_id uuid default null
) returns jsonb
```

Validation:

- amount must be positive.
- category must exist and category type must match `p_type`.
- cycle is optional.

### 7. `api_cash_transaction_delete`

Signature:

```sql
api_cash_transaction_delete(
  p_transaction_id uuid
) returns jsonb
```

Rules:

- Block delete when `source_sale_id IS NOT NULL`.
- Manual UI records can be deleted.

### 8. `api_profile_update`

Signature:

```sql
api_profile_update(
  p_language text,
  p_telegram_id text default ''
) returns jsonb
```

Rules:

- Updates current authenticated profile only.
- Validate language in `('id', 'en')`.

### 9. `api_pond_update`

Signature:

```sql
api_pond_update(
  p_unit_id uuid,
  p_name text default null,
  p_type text default null,
  p_capacity integer default null,
  p_is_active boolean default null,
  p_description text default null
) returns jsonb
```

Used by:

- Future pond edit/open/deactivate flow.

Rules:

- Owner only in V1.
- Capacity must be non-negative.

### 10. `api_cycle_start`

Signature:

```sql
api_cycle_start(
  p_unit_id uuid,
  p_fish_type_id uuid,
  p_date_start date,
  p_initial_stock integer,
  p_avg_seed_weight_g numeric default null,
  p_target_weight_g numeric default null,
  p_capital_rp integer default 0,
  p_description text default ''
) returns jsonb
```

Rules:

- Unit must not already have a running cycle.
- Creates cycle.
- Creates initial `stock_in` movement in same transaction.
- Honors `one_active_cycle_per_unit`.

### 11. `api_cycle_close`

Signature:

```sql
api_cycle_close(
  p_cycle_id uuid,
  p_date_end date,
  p_reason text default ''
) returns jsonb
```

Rules:

- `date_end >= date_start`.
- If live fish remains, create final `adjustment_out` or `personal_use` movement based on reason/policy.
- Close cycle in one transaction.

### 12. `api_cycle_transfer`

Signature:

```sql
api_cycle_transfer(
  p_cycle_id uuid,
  p_to_unit_id uuid,
  p_date date,
  p_reason text default ''
) returns jsonb
```

Rules:

- Source cycle must be running.
- Target unit must not have running cycle unless V1 explicitly supports merging.
- Close source cycle.
- Create new continuation cycle in target unit.
- Create paired `transfer_out` and `transfer_in` stock movements.

## Mutation Return Objects

Daily log mutation should return a `PondDailyLog`.

Stock movement mutation should return a `StockMovementListItem`.

Cash transaction mutation should return a `CashTransactionItem`.

Cycle mutations should return enough for FE refresh:

```json
{
  "ok": true,
  "pond_id": "uuid",
  "cycle_id": "uuid",
  "refresh": ["pond_detail", "ponds_list", "dashboard_summary", "stock_movements"]
}
```

## Frontend Query Invalidations

After `api_daily_log_create/update/delete`:

- invalidate `dashboard_summary`
- invalidate `pond_detail(pond_id)`

After `api_stock_movement_create/delete`:

- invalidate `dashboard_summary`
- invalidate `pond_detail(pond_id)`
- invalidate `stock_movements`

After `api_cash_transaction_create/delete`:

- invalidate `dashboard_summary`
- invalidate `cash_summary(month)`
- invalidate `cash_transactions(month)`

After `api_cycle_start/close/transfer`:

- invalidate `dashboard_summary`
- invalidate `ponds_list`
- invalidate `pond_detail`
- invalidate `stock_movements`
- invalidate `form_options`

After `api_profile_update`:

- invalidate `profile_me`

## Suggested RPC Implementation Order

1. Create views:
   - `api_v_current_cycles`
   - `api_v_cycle_stock_totals`
   - `api_v_latest_log_per_cycle`
   - `api_v_latest_weight_per_cycle`
   - `api_v_pond_cards`
   - `api_v_stock_movements_enriched`
   - `api_v_cash_transactions_enriched`
   - `api_v_daily_logs_enriched`
2. Implement read RPCs:
   - `api_ponds_list`
   - `api_pond_detail`
   - `api_dashboard_summary`
   - `api_stock_movements`
   - `api_cash_summary`
   - `api_cash_transactions`
   - `api_cash_categories`
   - `api_form_options`
3. Wire frontend reads.
4. Implement safe mutations:
   - daily log create/update/delete
   - stock movement create/delete
   - cash transaction create/delete
5. Implement operational mutations:
   - pond update
   - cycle start/close/transfer

## Non-Negotiable Validation Checklist

- No RPC accepts raw `category` text for cash writes. Use `category_id`.
- No RPC returns or accepts `water_condition`.
- No RPC writes `notes`; use `description`.
- No stock mutation can make live fish negative unless explicit owner override exists.
- No cash transaction delete can remove sale-generated cash rows in V1.
- No target pond can receive a transferred cycle if it already has a running cycle.
- No cycle start can bypass `one_active_cycle_per_unit`.
- Read RPCs should return empty arrays, not null arrays.
- Numeric percentages should be numbers, not formatted strings.
- Currency values should be integer Rupiah.
- Dates should be ISO `YYYY-MM-DD`; timestamps should be ISO datetime.

