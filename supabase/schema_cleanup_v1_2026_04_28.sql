-- KANIKAN Schema Cleanup V1
-- Date: 2026-04-28
--
-- Purpose:
-- 1. Move DB shape to the latest web-app/API schema.
-- 2. Standardize legacy notes/category/water_condition fields.
-- 3. Preserve legacy fish_inventory data by backfilling stock_movements before dropping it.
-- 4. Prepare the database for supabase/api_read_rpc_v1.sql.
--
-- Run this in Supabase SQL Editor before api_read_rpc_v1.sql.

begin;

-- =========================================================
-- 0) Preflight
-- =========================================================

do $$
declare
  v_missing text[];
begin
  select array_agg(table_name::text)
  into v_missing
  from (
    values
      ('profiles'),
      ('units'),
      ('fish_types'),
      ('cycles'),
      ('log_harian'),
      ('stock_movements'),
      ('penjualan'),
      ('kas'),
      ('kas_categories')
  ) required(table_name)
  where to_regclass('public.' || required.table_name) is null;

  if v_missing is not null then
    raise exception 'Missing required tables: %', array_to_string(v_missing, ', ');
  end if;
end $$;

-- =========================================================
-- 1) Standardize notes -> description
-- =========================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'units' and column_name = 'notes'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'units' and column_name = 'description'
  ) then
    alter table public.units rename column notes to description;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'units' and column_name = 'notes'
  ) then
    update public.units
    set description = coalesce(nullif(btrim(description), ''), nullif(btrim(notes), ''));
    alter table public.units drop column notes;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cycles' and column_name = 'notes'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cycles' and column_name = 'description'
  ) then
    alter table public.cycles rename column notes to description;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cycles' and column_name = 'notes'
  ) then
    update public.cycles
    set description = coalesce(nullif(btrim(description), ''), nullif(btrim(notes), ''));
    alter table public.cycles drop column notes;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'stock_movements' and column_name = 'notes'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'stock_movements' and column_name = 'description'
  ) then
    alter table public.stock_movements rename column notes to description;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'stock_movements' and column_name = 'notes'
  ) then
    update public.stock_movements
    set description = coalesce(nullif(btrim(description), ''), nullif(btrim(notes), ''));
    alter table public.stock_movements drop column notes;
  end if;
end $$;

alter table public.log_harian
  add column if not exists description text;

alter table public.kas
  add column if not exists description text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'kas' and column_name = 'notes'
  ) then
    update public.kas
    set description = nullif(
      concat_ws(
        ' | ',
        nullif(btrim(description), ''),
        case
          when notes is not null and btrim(notes) <> '' then 'Note: ' || btrim(notes)
          else null
        end
      ),
      ''
    );

    alter table public.kas drop column notes;
  end if;
end $$;

-- =========================================================
-- 2) Remove deprecated log_harian.water_condition
-- =========================================================

alter table public.log_harian
  drop column if exists water_condition;

-- =========================================================
-- 3) Stock ledger hardening and fish_inventory cutover
-- =========================================================

alter table public.stock_movements
  add column if not exists meta jsonb not null default '{}'::jsonb,
  add column if not exists source_table text,
  add column if not exists source_row_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'stock_movements_source_unique'
      and conrelid = 'public.stock_movements'::regclass
  ) then
    alter table public.stock_movements
      add constraint stock_movements_source_unique
      unique (source_table, source_row_id, movement_type);
  end if;
end $$;

do $$
begin
  if to_regclass('public.fish_inventory') is not null then
    insert into public.stock_movements (
      date,
      unit_id,
      fish_type_id,
      cycle_id,
      movement_type,
      count,
      description,
      meta,
      source_table,
      source_row_id,
      created_by,
      created_at
    )
    select
      fi.date,
      fi.unit_id,
      fi.fish_type_id,
      fi.cycle_id,
      'stock_in',
      fi.stock_in,
      fi.notes,
      jsonb_build_object('legacy_backfill', true, 'legacy_column', 'stock_in'),
      'fish_inventory',
      fi.id,
      fi.created_by,
      fi.created_at
    from public.fish_inventory fi
    where coalesce(fi.stock_in, 0) > 0
    on conflict (source_table, source_row_id, movement_type) do nothing;

    insert into public.stock_movements (
      date,
      unit_id,
      fish_type_id,
      cycle_id,
      movement_type,
      count,
      description,
      meta,
      source_table,
      source_row_id,
      created_by,
      created_at
    )
    select
      fi.date,
      fi.unit_id,
      fi.fish_type_id,
      fi.cycle_id,
      'died',
      fi.died,
      fi.notes,
      jsonb_build_object('legacy_backfill', true, 'legacy_column', 'died'),
      'fish_inventory',
      fi.id,
      fi.created_by,
      fi.created_at
    from public.fish_inventory fi
    where coalesce(fi.died, 0) > 0
    on conflict (source_table, source_row_id, movement_type) do nothing;

    insert into public.stock_movements (
      date,
      unit_id,
      fish_type_id,
      cycle_id,
      movement_type,
      count,
      description,
      meta,
      source_table,
      source_row_id,
      created_by,
      created_at
    )
    select
      fi.date,
      fi.unit_id,
      fi.fish_type_id,
      fi.cycle_id,
      'sold',
      fi.sold,
      fi.notes,
      jsonb_build_object('legacy_backfill', true, 'legacy_column', 'sold'),
      'fish_inventory',
      fi.id,
      fi.created_by,
      fi.created_at
    from public.fish_inventory fi
    where coalesce(fi.sold, 0) > 0
    on conflict (source_table, source_row_id, movement_type) do nothing;
  end if;
end $$;

drop view if exists public.siklus_panen;
drop table if exists public.fish_inventory;

-- =========================================================
-- 4) Normalize cash category and cash sale traceability
-- =========================================================

insert into public.kas_categories (type, name, sort_order)
select seed.type, seed.name, seed.sort_order
from (
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
) as seed(type, name, sort_order)
where not exists (
  select 1
  from public.kas_categories kc
  where kc.type = seed.type
    and kc.name = seed.name
);

delete from public.kas_categories kc
using public.kas_categories duplicate
where kc.type = duplicate.type
  and kc.name = duplicate.name
  and (
    coalesce(kc.sort_order, 999999) > coalesce(duplicate.sort_order, 999999)
    or (
      coalesce(kc.sort_order, 999999) = coalesce(duplicate.sort_order, 999999)
      and kc.id > duplicate.id
    )
  );

create unique index if not exists kas_categories_type_name_unique
on public.kas_categories (type, name);

alter table public.kas
  add column if not exists category_id uuid,
  add column if not exists source_sale_id uuid;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'kas' and column_name = 'category'
  ) then
    insert into public.kas_categories (type, name, sort_order)
    select distinct k.type, k.category, 999
    from public.kas k
    where k.category is not null
      and btrim(k.category) <> ''
    on conflict (type, name) do nothing;

    update public.kas k
    set category_id = kc.id
    from public.kas_categories kc
    where kc.type = k.type
      and kc.name = k.category
      and k.category_id is null;
  end if;
end $$;

update public.kas k
set category_id = kc.id
from public.kas_categories kc
where k.category_id is null
  and kc.type = k.type
  and kc.name = case when k.type = 'Masuk' then 'Lain-lain' else 'Lain-lain' end;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'kas_category_id_fkey'
      and conrelid = 'public.kas'::regclass
  ) then
    alter table public.kas
      add constraint kas_category_id_fkey
      foreign key (category_id) references public.kas_categories(id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'kas_source_sale_id_fkey'
      and conrelid = 'public.kas'::regclass
  ) then
    alter table public.kas
      add constraint kas_source_sale_id_fkey
      foreign key (source_sale_id) references public.penjualan(id);
  end if;
end $$;

do $$
begin
  if exists (select 1 from public.kas where category_id is null) then
    raise exception 'Cannot set kas.category_id NOT NULL. Some rows are unmapped.';
  end if;

  alter table public.kas
    alter column category_id set not null;
end $$;

alter table public.kas
  drop column if exists category;

-- =========================================================
-- 5) Defaults, constraints, and indexes
-- =========================================================

update public.profiles
set language = 'id'
where language is null;

alter table public.profiles
  alter column language set not null;

alter table public.cycles
  alter column initial_stock set default 0,
  alter column capital_rp set default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cycles_initial_stock_non_negative' and conrelid = 'public.cycles'::regclass) then
    alter table public.cycles
      add constraint cycles_initial_stock_non_negative
      check (initial_stock is null or initial_stock >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cycles_capital_non_negative' and conrelid = 'public.cycles'::regclass) then
    alter table public.cycles
      add constraint cycles_capital_non_negative
      check (capital_rp is null or capital_rp >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cycles_valid_dates' and conrelid = 'public.cycles'::regclass) then
    alter table public.cycles
      add constraint cycles_valid_dates
      check (date_end is null or date_end >= date_start) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cycles_weights_non_negative' and conrelid = 'public.cycles'::regclass) then
    alter table public.cycles
      add constraint cycles_weights_non_negative
      check (
        coalesce(target_weight_g, 0) >= 0
        and coalesce(avg_seed_weight_g, 0) >= 0
      ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'log_harian_non_negative_values' and conrelid = 'public.log_harian'::regclass) then
    alter table public.log_harian
      add constraint log_harian_non_negative_values
      check (
        coalesce(feed_g, 0) >= 0
        and coalesce(sample_weight_g, 0) >= 0
        and coalesce(sample_count, 0) >= 0
      ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'stock_movements_weight_non_negative' and conrelid = 'public.stock_movements'::regclass) then
    alter table public.stock_movements
      add constraint stock_movements_weight_non_negative
      check (weight_kg is null or weight_kg >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'penjualan_weight_positive' and conrelid = 'public.penjualan'::regclass) then
    alter table public.penjualan
      add constraint penjualan_weight_positive
      check (weight_kg > 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'penjualan_price_positive' and conrelid = 'public.penjualan'::regclass) then
    alter table public.penjualan
      add constraint penjualan_price_positive
      check (price_per_kg > 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'penjualan_sold_count_non_negative' and conrelid = 'public.penjualan'::regclass) then
    alter table public.penjualan
      add constraint penjualan_sold_count_non_negative
      check (sold_count is null or sold_count >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'penjualan_sold_count_source_valid' and conrelid = 'public.penjualan'::regclass) then
    alter table public.penjualan
      add constraint penjualan_sold_count_source_valid
      check (sold_count_source is null or sold_count_source in ('manual', 'estimated')) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'penjualan_avg_weight_non_negative' and conrelid = 'public.penjualan'::regclass) then
    alter table public.penjualan
      add constraint penjualan_avg_weight_non_negative
      check (avg_weight_used_g is null or avg_weight_used_g >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'kas_amount_positive' and conrelid = 'public.kas'::regclass) then
    alter table public.kas
      add constraint kas_amount_positive
      check (amount_rp > 0) not valid;
  end if;
end $$;

create unique index if not exists one_active_cycle_per_unit
on public.cycles (unit_id)
where date_end is null;

create index if not exists idx_profiles_telegram_id on public.profiles (telegram_id);
create index if not exists idx_units_active on public.units (is_active);
create index if not exists idx_cycles_unit_active on public.cycles (unit_id, date_end);
create index if not exists idx_cycles_fish_type on public.cycles (fish_type_id);
create index if not exists idx_log_harian_unit_created on public.log_harian (unit_id, created_at desc);
create index if not exists idx_log_harian_cycle_date on public.log_harian (cycle_id, date desc, created_at desc);
create index if not exists stock_movements_unit_idx on public.stock_movements (unit_id, date desc, created_at desc);
create index if not exists stock_movements_cycle_idx on public.stock_movements (cycle_id, date desc, created_at desc);
create index if not exists stock_movements_type_idx on public.stock_movements (movement_type);
create index if not exists idx_penjualan_created_at on public.penjualan (created_at desc);
create index if not exists idx_penjualan_cycle on public.penjualan (cycle_id);
create index if not exists idx_kas_created_at on public.kas (created_at desc);
create index if not exists idx_kas_date on public.kas (date desc);
create index if not exists idx_kas_category_id on public.kas (category_id);
create index if not exists idx_kas_source_sale_id on public.kas (source_sale_id);

-- =========================================================
-- 6) Comments
-- =========================================================

comment on table public.stock_movements is 'Primary stock ledger for bot, API, analytics, and future AI features.';
comment on column public.units.description is 'Human-readable description for this pond/unit.';
comment on column public.cycles.description is 'Human-readable description for this cycle.';
comment on column public.stock_movements.description is 'Human-readable description for this stock movement.';
comment on column public.log_harian.description is 'Human-readable daily note or observation.';
comment on column public.kas.description is 'Human-readable cash transaction description.';
comment on column public.kas.category_id is 'Normalized cash category reference.';
comment on column public.kas.source_sale_id is 'Optional link to sale-generated cash transaction.';
comment on column public.penjualan.sold_count is 'Jumlah ekor terjual jika diketahui atau berhasil diestimasi.';
comment on column public.penjualan.sold_count_source is 'Sumber nilai sold_count: manual atau estimated.';
comment on column public.penjualan.avg_weight_used_g is 'Bobot rata-rata yang dipakai saat estimasi sold_count.';

commit;

-- =========================================================
-- Optional verification query. Run after this migration.
-- =========================================================
--
-- select
--   to_regclass('public.fish_inventory') is null as fish_inventory_removed,
--   not exists (
--     select 1 from information_schema.columns
--     where table_schema = 'public'
--       and column_name in ('notes', 'water_condition', 'category')
--       and table_name in ('units', 'cycles', 'stock_movements', 'log_harian', 'kas')
--   ) as legacy_columns_removed,
--   not exists (select 1 from public.kas where category_id is null) as kas_category_id_complete,
--   exists (
--     select 1 from pg_indexes
--     where schemaname = 'public' and indexname = 'one_active_cycle_per_unit'
--   ) as one_active_cycle_guard_exists;
