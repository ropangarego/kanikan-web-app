# KANIKAN DB Release Runbook

Last updated: 2026-05-12

## Files

```text
schema_cleanup_v1_2026_04_28.sql
api_read_rpc_v1.sql
api_mutation_rpc_v1.sql
feeding_v1_2026_05_12.sql
production_reset_seed_v1.sql
development_dummy_seed_v1.sql
```

## Production Release

Use this when releasing with a clean production operational database.

Run in Supabase SQL Editor:

```text
1. schema_cleanup_v1_2026_04_28.sql
2. api_read_rpc_v1.sql
3. api_mutation_rpc_v1.sql
4. feeding_v1_2026_05_12.sql
5. production_reset_seed_v1.sql
```

Important:

- `production_reset_seed_v1.sql` clears operational data.
- Supabase auth users and `profiles` are kept.
- Fish types and cash categories are seeded.
- Do not run dummy seed on production.

## Development / Testing

Use this on a test Supabase project:

```text
1. schema_cleanup_v1_2026_04_28.sql
2. api_read_rpc_v1.sql
3. api_mutation_rpc_v1.sql
4. feeding_v1_2026_05_12.sql
5. development_dummy_seed_v1.sql
```

Dummy seed creates test ponds, cycles, stock movements, logs, and cash rows.

## Verification

After SQL finishes:

```sql
select * from public.api_ponds_list(true);
select public.api_dashboard_summary();
select public.api_feeding_page(current_date, 'morning');
```

Then open the web-app and test:

- Dashboard loads.
- Ponds list loads.
- Owner can add pond.
- Start cycle works.
- Stock movement works.
- Cash transaction works.
- Feeding page loads.
- Feeding session save works after active ponds exist.
- Language persists.
