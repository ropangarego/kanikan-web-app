-- KANIKAN V1 development/testing dummy seed
-- Date: 2026-05-02
--
-- Purpose:
-- - Populate realistic test data for web-app and bot testing.
-- - Uses the latest V1 schema shape.
-- - Safe to rerun for the named Test units.
--
-- Do not run this on production.

begin;

delete from public.kas
where cycle_id in (
  select c.id
  from public.cycles c
  join public.units u on u.id = c.unit_id
  where u.name in ('Test Bucket 1', 'Test Bucket 2', 'Test Bucket 3', 'Test Kolam 1', 'Test Kolam 2', 'Test Quarantine 1')
)
or description ilike 'Dummy %'
or description ilike 'Test %';

delete from public.penjualan
where cycle_id in (
  select c.id
  from public.cycles c
  join public.units u on u.id = c.unit_id
  where u.name in ('Test Bucket 1', 'Test Bucket 2', 'Test Bucket 3', 'Test Kolam 1', 'Test Kolam 2', 'Test Quarantine 1')
)
or buyer ilike 'Dummy %'
or buyer ilike 'Test %';

delete from public.stock_movements
where unit_id in (
  select id from public.units
  where name in ('Test Bucket 1', 'Test Bucket 2', 'Test Bucket 3', 'Test Kolam 1', 'Test Kolam 2', 'Test Quarantine 1')
)
or source_table = 'development_dummy_seed_v1';

delete from public.log_harian
where unit_id in (
  select id from public.units
  where name in ('Test Bucket 1', 'Test Bucket 2', 'Test Bucket 3', 'Test Kolam 1', 'Test Kolam 2', 'Test Quarantine 1')
);

delete from public.cycles
where unit_id in (
  select id from public.units
  where name in ('Test Bucket 1', 'Test Bucket 2', 'Test Bucket 3', 'Test Kolam 1', 'Test Kolam 2', 'Test Quarantine 1')
);

delete from public.units
where name in ('Test Bucket 1', 'Test Bucket 2', 'Test Bucket 3', 'Test Kolam 1', 'Test Kolam 2', 'Test Quarantine 1');

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

insert into public.units (name, type, capacity, is_active, description)
values
  ('Test Bucket 1', 'ember', 80, true, 'Dummy active lele growout'),
  ('Test Bucket 2', 'ember', 100, true, 'Dummy active lele without target'),
  ('Test Bucket 3', 'ember', 90, true, 'Dummy empty unit'),
  ('Test Kolam 1', 'kolam', 3000, true, 'Dummy active nila pond'),
  ('Test Kolam 2', 'kolam', 3500, true, 'Dummy active transferred patin'),
  ('Test Quarantine 1', 'bak', 500, false, 'Dummy inactive reserve unit');

with ids as (
  select
    (select id from public.fish_types where name = 'Lele') as lele_id,
    (select id from public.fish_types where name = 'Nila') as nila_id,
    (select id from public.fish_types where name = 'Patin') as patin_id,
    (select id from public.units where name = 'Test Bucket 1') as bucket1_id,
    (select id from public.units where name = 'Test Bucket 2') as bucket2_id,
    (select id from public.units where name = 'Test Bucket 3') as bucket3_id,
    (select id from public.units where name = 'Test Kolam 1') as kolam1_id,
    (select id from public.units where name = 'Test Kolam 2') as kolam2_id
),
created_cycles as (
  insert into public.cycles (
    name,
    unit_id,
    fish_type_id,
    date_start,
    date_end,
    initial_stock,
    target_weight_g,
    avg_seed_weight_g,
    capital_rp,
    description
  )
  select 'Cycle 101', bucket1_id, lele_id, (current_date - interval '75 days')::date, null::date, 1200, 180, 5, 150000, 'Dummy active cycle - near harvest' from ids
  union all
  select 'Cycle 102', bucket2_id, lele_id, (current_date - interval '28 days')::date, null::date, 800, null, 4, 95000, 'Dummy active cycle - target missing' from ids
  union all
  select 'Cycle 103', kolam1_id, nila_id, (current_date - interval '54 days')::date, null::date, 2000, 250, 8, 450000, 'Dummy active nila cycle' from ids
  union all
  select 'Cycle 104', bucket3_id, patin_id, (current_date - interval '40 days')::date, (current_date - interval '10 days')::date, 600, 320, 12, 300000, 'Dummy closed cycle' from ids
  union all
  select 'Cycle 105', kolam2_id, patin_id, (current_date - interval '10 days')::date, null::date, 585, 320, 190, 0, 'Dummy active cycle after transfer' from ids
  returning id, name, unit_id, fish_type_id
),
dummy_stock as (
  insert into public.stock_movements (
    date,
    unit_id,
    fish_type_id,
    cycle_id,
    movement_type,
    count,
    weight_kg,
    description,
    meta,
    source_table,
    source_row_id
  )
  select (current_date - interval '75 days')::date, unit_id, fish_type_id, id, 'stock_in', 1200, 6, 'Dummy seed stock in', '{"dummy": true}'::jsonb, 'development_dummy_seed_v1', gen_random_uuid() from created_cycles where name = 'Cycle 101'
  union all
  select (current_date - interval '50 days')::date, unit_id, fish_type_id, id, 'died', 35, null, 'Dummy early mortality', '{"dummy": true}'::jsonb, 'development_dummy_seed_v1', gen_random_uuid() from created_cycles where name = 'Cycle 101'
  union all
  select (current_date - interval '14 days')::date, unit_id, fish_type_id, id, 'sold', 180, 28, 'Dummy sale stock deduction', '{"dummy": true}'::jsonb, 'development_dummy_seed_v1', gen_random_uuid() from created_cycles where name = 'Cycle 101'
  union all
  select (current_date - interval '28 days')::date, unit_id, fish_type_id, id, 'stock_in', 800, 3.2, 'Dummy seed stock in', '{"dummy": true}'::jsonb, 'development_dummy_seed_v1', gen_random_uuid() from created_cycles where name = 'Cycle 102'
  union all
  select (current_date - interval '54 days')::date, unit_id, fish_type_id, id, 'stock_in', 2000, 16, 'Dummy nila seed stock in', '{"dummy": true}'::jsonb, 'development_dummy_seed_v1', gen_random_uuid() from created_cycles where name = 'Cycle 103'
  union all
  select (current_date - interval '40 days')::date, unit_id, fish_type_id, id, 'stock_in', 600, 7.2, 'Dummy patin seed stock in', '{"dummy": true}'::jsonb, 'development_dummy_seed_v1', gen_random_uuid() from created_cycles where name = 'Cycle 104'
  union all
  select (current_date - interval '10 days')::date, unit_id, fish_type_id, id, 'transfer_out', 585, null, 'Dummy transfer out to Test Kolam 2', '{"dummy": true}'::jsonb, 'development_dummy_seed_v1', gen_random_uuid() from created_cycles where name = 'Cycle 104'
  union all
  select (current_date - interval '10 days')::date, unit_id, fish_type_id, id, 'transfer_in', 585, null, 'Dummy transfer in from Test Bucket 3', '{"dummy": true}'::jsonb, 'development_dummy_seed_v1', gen_random_uuid() from created_cycles where name = 'Cycle 105'
  returning id
)
insert into public.log_harian (
  date,
  unit_id,
  fish_type_id,
  cycle_id,
  feed_g,
  event,
  action,
  description,
  sample_weight_g,
  sample_count
)
select (current_date - interval '14 days')::date, unit_id, fish_type_id, id, 3200, 'Nafsu makan bagus', 'Lanjut pakan normal', 'Dummy log sample 1', 138, 20 from created_cycles where name = 'Cycle 101'
union all
select (current_date - interval '7 days')::date, unit_id, fish_type_id, id, 3500, 'Air normal', 'Pantau pertumbuhan', 'Dummy log sample 2', 154, 20 from created_cycles where name = 'Cycle 101'
union all
select current_date, unit_id, fish_type_id, id, 3800, 'Siap cek panen', 'Cek sampling ulang', 'Dummy log sample 3', 171, 20 from created_cycles where name = 'Cycle 101'
union all
select (current_date - interval '3 days')::date, unit_id, fish_type_id, id, 2100, 'Target belum diisi', 'Isi target berat', 'Dummy target warning', 44, 20 from created_cycles where name = 'Cycle 102'
union all
select (current_date - interval '7 days')::date, unit_id, fish_type_id, id, 5500, 'Pertumbuhan stabil', 'Lanjut monitoring', 'Dummy nila sample 1', 82, 25 from created_cycles where name = 'Cycle 103'
union all
select current_date, unit_id, fish_type_id, id, 5800, 'Pertumbuhan stabil', 'Lanjut monitoring', 'Dummy nila sample 2', 93, 25 from created_cycles where name = 'Cycle 103'
union all
select current_date, unit_id, fish_type_id, id, 4200, 'Adaptasi setelah pindah', 'Pantau stress', 'Dummy transfer follow-up', 205, 15 from created_cycles where name = 'Cycle 105';

with active_cycles as (
  select c.id, c.name
  from public.cycles c
  join public.units u on u.id = c.unit_id
  where u.name in ('Test Bucket 1', 'Test Kolam 1')
),
categories as (
  select
    (select id from public.kas_categories where type = 'Masuk' and name = 'Penjualan') as sales_in_id,
    (select id from public.kas_categories where type = 'Keluar' and name = 'Pakan') as feed_out_id
)
insert into public.kas (date, type, category_id, description, cycle_id, amount_rp)
select (current_date - interval '14 days')::date, 'Masuk', sales_in_id, 'Dummy sale income', (select id from active_cycles where name = 'Cycle 101'), 560000 from categories
union all
select (current_date - interval '5 days')::date, 'Keluar', feed_out_id, 'Dummy feed purchase', (select id from active_cycles where name = 'Cycle 101'), 180000 from categories
union all
select (current_date - interval '3 days')::date, 'Keluar', feed_out_id, 'Dummy feed purchase nila', (select id from active_cycles where name = 'Cycle 103'), 240000 from categories;

commit;

