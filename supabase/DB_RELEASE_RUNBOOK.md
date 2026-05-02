# KANIKAN DB Release Runbook

Last updated: 2026-05-02

## Files

```text
01_schema_cleanup_v1_2026_04_28.sql
02_api_read_rpc_v1.sql
03_api_mutation_rpc_v1.sql
04_production_reset_seed_v1.sql
05_development_dummy_seed_v1.sql
```

## Production Release

Use this when releasing with a clean production operational database.

Run in Supabase SQL Editor:

```text
1. 01_schema_cleanup_v1_2026_04_28.sql
2. 02_api_read_rpc_v1.sql
3. 03_api_mutation_rpc_v1.sql
4. 04_production_reset_seed_v1.sql
```

Important:

- `04_production_reset_seed_v1.sql` clears operational data.
- Supabase auth users and `profiles` are kept.
- Fish types and cash categories are seeded.
- Do not run dummy seed on production.

## Development / Testing

Use this on a test Supabase project:

```text
1. 01_schema_cleanup_v1_2026_04_28.sql
2. 02_api_read_rpc_v1.sql
3. 03_api_mutation_rpc_v1.sql
4. 05_development_dummy_seed_v1.sql
```

Dummy seed creates test ponds, cycles, stock movements, logs, and cash rows.

## Verification

After SQL finishes:

```sql
select * from public.api_farm_status_summary();
select * from public.api_ponds_list(true);
select * from public.api_cash_ledger(null, null, null, null, 20, 0);
```

Then open the web-app and test:

- Dashboard loads.
- Ponds list loads.
- Owner can add pond.
- Start cycle works.
- Stock movement works.
- Cash transaction works.
- Language persists.

