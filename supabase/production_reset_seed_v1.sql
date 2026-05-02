-- KANIKAN V1 production reset + required seed
-- Date: 2026-05-02
--
-- Purpose:
-- - Clear operational data for release.
-- - Keep Supabase auth users and public.profiles.
-- - Seed required fish types and cash categories.
--
-- Run after:
-- 1. 01_schema_cleanup_v1_2026_04_28.sql
-- 2. 02_api_read_rpc_v1.sql
-- 3. 03_api_mutation_rpc_v1.sql
--
-- WARNING:
-- This deletes operational farm data from units, cycles, logs, stock, sales, and cash.
-- Do not run on a production database unless a clean release reset is intended.

begin;

truncate table
  public.kas,
  public.penjualan,
  public.stock_movements,
  public.log_harian,
  public.cycles,
  public.units
restart identity cascade;

do $$
begin
  if to_regclass('public.fish_inventory') is not null then
    truncate table public.fish_inventory restart identity cascade;
  end if;
end $$;

delete from public.kas_categories;
delete from public.fish_types;

insert into public.fish_types (name, growth_rate_g_per_day)
values
  ('Lele', 1.2),
  ('Nila', 0.8),
  ('Patin', 1.0)
on conflict (name) do update
set growth_rate_g_per_day = excluded.growth_rate_g_per_day;

insert into public.kas_categories (type, name, sort_order)
values
  ('Masuk', 'Penjualan', 1),
  ('Masuk', 'Modal', 2),
  ('Masuk', 'Lain-lain', 3),
  ('Keluar', 'Pakan', 1),
  ('Keluar', 'Benih', 2),
  ('Keluar', 'Obat/Suplemen', 3),
  ('Keluar', 'Peralatan', 4),
  ('Keluar', 'Operasional', 5),
  ('Keluar', 'Lain-lain', 6)
on conflict (type, name) do update
set sort_order = excluded.sort_order;

commit;

-- Quick verification:
-- select count(*) as units_count from public.units;
-- select count(*) as cycles_count from public.cycles;
-- select count(*) as log_count from public.log_harian;
-- select count(*) as stock_count from public.stock_movements;
-- select count(*) as cash_count from public.kas;
-- select type, name from public.kas_categories order by type, sort_order;
-- select name from public.fish_types order by name;

