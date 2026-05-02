-- KANIKAN API Mutation RPC V1
-- Run after:
-- 1) supabase/schema_cleanup_v1_2026_04_28.sql
-- 2) supabase/api_read_rpc_v1.sql
--
-- This file creates the first write layer used by the web app.

begin;

create or replace function public.api_current_profile_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := public.api_require_auth();

  if not exists (select 1 from public.profiles p where p.id = v_user_id) then
    raise exception 'PROFILE_NOT_FOUND' using errcode = '28000';
  end if;

  return v_user_id;
end;
$$;

create or replace function public.api_live_fish_for_cycle(p_cycle_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(st.live_fish_count, 0)::integer
  from public.api_v_cycle_stock_totals st
  where st.cycle_id = p_cycle_id;
$$;

create or replace function public.api_pond_create(
  p_name text,
  p_type text default null,
  p_capacity integer default null,
  p_is_active boolean default false,
  p_description text default ''
) returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_pond_id uuid;
begin
  perform public.api_current_profile_id();

  if not public.api_is_owner() then
    raise exception 'OWNER_REQUIRED' using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'POND_NAME_REQUIRED' using errcode = '22023';
  end if;

  if p_capacity is not null and p_capacity < 0 then
    raise exception 'CAPACITY_MUST_BE_NON_NEGATIVE' using errcode = '22003';
  end if;

  insert into public.units (
    name,
    type,
    capacity,
    is_active,
    description
  ) values (
    btrim(p_name),
    nullif(btrim(coalesce(p_type, '')), ''),
    p_capacity,
    coalesce(p_is_active, false),
    coalesce(p_description, '')
  )
  returning id into v_pond_id;

  return jsonb_build_object(
    'ok', true,
    'item', jsonb_build_object('pond_id', v_pond_id),
    'refresh', jsonb_build_array('ponds_list', 'pond_detail', 'dashboard_summary', 'stock_movements', 'form_options')
  );
end;
$$;

create or replace function public.api_daily_log_create(
  p_date date,
  p_unit_id uuid,
  p_feed_g numeric,
  p_event text default '',
  p_action text default '',
  p_description text default '',
  p_sample_weight_g numeric default null,
  p_sample_count integer default null
) returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.api_current_profile_id();
  v_cycle record;
  v_log_id uuid;
begin
  if coalesce(p_feed_g, 0) < 0
    or coalesce(p_sample_weight_g, 0) < 0
    or coalesce(p_sample_count, 0) < 0 then
    raise exception 'NEGATIVE_VALUE_NOT_ALLOWED' using errcode = '22003';
  end if;

  select c.*
  into v_cycle
  from public.cycles c
  where c.unit_id = p_unit_id
    and c.date_end is null
  limit 1;

  if v_cycle.id is null then
    raise exception 'NO_ACTIVE_CYCLE' using errcode = 'P0001';
  end if;

  insert into public.log_harian (
    date,
    unit_id,
    cycle_id,
    fish_type_id,
    feed_g,
    event,
    action,
    description,
    sample_weight_g,
    sample_count,
    created_by
  ) values (
    p_date,
    p_unit_id,
    v_cycle.id,
    v_cycle.fish_type_id,
    coalesce(p_feed_g, 0),
    coalesce(p_event, ''),
    coalesce(p_action, ''),
    coalesce(p_description, ''),
    p_sample_weight_g,
    p_sample_count,
    v_profile_id
  )
  returning id into v_log_id;

  return jsonb_build_object(
    'ok', true,
    'item', (select to_jsonb(l) from public.api_v_daily_logs_enriched l where l.log_id = v_log_id),
    'refresh', jsonb_build_array('dashboard_summary', 'pond_detail')
  );
end;
$$;

create or replace function public.api_daily_log_delete(
  p_log_id uuid
) returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.api_current_profile_id();
  v_log record;
begin
  select *
  into v_log
  from public.log_harian
  where id = p_log_id;

  if v_log.id is null then
    raise exception 'LOG_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not public.api_is_owner() and v_log.created_by <> v_profile_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  delete from public.log_harian where id = p_log_id;

  return jsonb_build_object('ok', true, 'refresh', jsonb_build_array('dashboard_summary', 'pond_detail'));
end;
$$;

create or replace function public.api_daily_log_update(
  p_log_id uuid,
  p_date date,
  p_feed_g numeric,
  p_event text default '',
  p_action text default '',
  p_description text default '',
  p_sample_weight_g numeric default null,
  p_sample_count integer default null
) returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.api_current_profile_id();
  v_log record;
begin
  if coalesce(p_feed_g, 0) < 0
    or coalesce(p_sample_weight_g, 0) < 0
    or coalesce(p_sample_count, 0) < 0 then
    raise exception 'NEGATIVE_VALUE_NOT_ALLOWED' using errcode = '22003';
  end if;

  select *
  into v_log
  from public.log_harian
  where id = p_log_id;

  if v_log.id is null then
    raise exception 'LOG_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not public.api_is_owner() and v_log.created_by <> v_profile_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update public.log_harian
  set
    date = p_date,
    feed_g = coalesce(p_feed_g, 0),
    event = coalesce(p_event, ''),
    action = coalesce(p_action, ''),
    description = coalesce(p_description, ''),
    sample_weight_g = p_sample_weight_g,
    sample_count = p_sample_count
  where id = p_log_id;

  return jsonb_build_object(
    'ok', true,
    'item', (select to_jsonb(l) from public.api_v_daily_logs_enriched l where l.log_id = p_log_id),
    'refresh', jsonb_build_array('dashboard_summary', 'pond_detail')
  );
end;
$$;

create or replace function public.api_stock_movement_create(
  p_date date,
  p_unit_id uuid,
  p_movement_type text,
  p_count integer,
  p_weight_kg numeric default null,
  p_description text default '',
  p_to_unit_id uuid default null
) returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.api_current_profile_id();
  v_cycle record;
  v_target_cycle record;
  v_live integer;
  v_movement_id uuid;
  v_pair_id uuid := gen_random_uuid();
  v_outgoing_types text[] := array['sold', 'died', 'transfer_out', 'adjustment_out', 'personal_use'];
begin
  if p_movement_type not in (
    'stock_in',
    'sold',
    'died',
    'transfer_out',
    'transfer_in',
    'adjustment_in',
    'adjustment_out',
    'personal_use'
  ) then
    raise exception 'INVALID_MOVEMENT_TYPE' using errcode = '22023';
  end if;

  if coalesce(p_count, 0) <= 0 then
    raise exception 'COUNT_MUST_BE_POSITIVE' using errcode = '22003';
  end if;

  if p_weight_kg is not null and p_weight_kg < 0 then
    raise exception 'WEIGHT_MUST_BE_NON_NEGATIVE' using errcode = '22003';
  end if;

  select c.*
  into v_cycle
  from public.cycles c
  where c.unit_id = p_unit_id
    and c.date_end is null
  limit 1;

  if v_cycle.id is null then
    raise exception 'NO_ACTIVE_CYCLE' using errcode = 'P0001';
  end if;

  if p_movement_type = any(v_outgoing_types) then
    v_live := public.api_live_fish_for_cycle(v_cycle.id);
    if v_live < p_count then
      raise exception 'INSUFFICIENT_STOCK' using errcode = '22003';
    end if;
  end if;

  if p_movement_type = 'transfer_out' then
    if p_to_unit_id is null or p_to_unit_id = p_unit_id then
      raise exception 'INVALID_TRANSFER_TARGET' using errcode = '22023';
    end if;

    select c.*
    into v_target_cycle
    from public.cycles c
    where c.unit_id = p_to_unit_id
      and c.date_end is null
    limit 1;

    if v_target_cycle.id is null then
      raise exception 'TARGET_HAS_NO_ACTIVE_CYCLE' using errcode = 'P0001';
    end if;

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
      source_row_id,
      created_by
    ) values (
      p_date,
      p_unit_id,
      v_cycle.fish_type_id,
      v_cycle.id,
      'transfer_out',
      p_count,
      p_weight_kg,
      coalesce(p_description, ''),
      jsonb_build_object('pair_id', v_pair_id, 'to_unit_id', p_to_unit_id),
      'manual_ui',
      v_pair_id,
      v_profile_id
    )
    returning id into v_movement_id;

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
      source_row_id,
      created_by
    ) values (
      p_date,
      p_to_unit_id,
      v_target_cycle.fish_type_id,
      v_target_cycle.id,
      'transfer_in',
      p_count,
      p_weight_kg,
      coalesce(p_description, ''),
      jsonb_build_object('pair_id', v_pair_id, 'from_unit_id', p_unit_id),
      'manual_ui',
      v_pair_id,
      v_profile_id
    );
  else
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
      source_row_id,
      created_by
    ) values (
      p_date,
      p_unit_id,
      v_cycle.fish_type_id,
      v_cycle.id,
      p_movement_type,
      p_count,
      p_weight_kg,
      coalesce(p_description, ''),
      '{}'::jsonb,
      'manual_ui',
      gen_random_uuid(),
      v_profile_id
    )
    returning id into v_movement_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'item', (select to_jsonb(m) from public.api_v_stock_movements_enriched m where m.movement_id = v_movement_id),
    'refresh', jsonb_build_array('dashboard_summary', 'pond_detail', 'stock_movements')
  );
end;
$$;

create or replace function public.api_stock_movement_delete(
  p_movement_id uuid
) returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_movement record;
begin
  perform public.api_current_profile_id();

  select *
  into v_movement
  from public.stock_movements
  where id = p_movement_id;

  if v_movement.id is null then
    raise exception 'MOVEMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not (v_movement.source_table is null or v_movement.source_table = 'manual_ui') then
    raise exception 'MOVEMENT_DELETE_BLOCKED' using errcode = '42501';
  end if;

  if v_movement.movement_type in ('transfer_in', 'transfer_out') and v_movement.source_row_id is not null then
    delete from public.stock_movements
    where source_table = 'manual_ui'
      and source_row_id = v_movement.source_row_id
      and movement_type in ('transfer_in', 'transfer_out');
  else
    delete from public.stock_movements where id = p_movement_id;
  end if;

  return jsonb_build_object('ok', true, 'refresh', jsonb_build_array('dashboard_summary', 'pond_detail', 'stock_movements'));
end;
$$;

create or replace function public.api_cash_transaction_create(
  p_date date,
  p_type text,
  p_category_id uuid,
  p_amount_rp integer,
  p_description text default '',
  p_cycle_id uuid default null
) returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.api_current_profile_id();
  v_category record;
  v_transaction_id uuid;
begin
  if p_type not in ('Masuk', 'Keluar') then
    raise exception 'INVALID_CASH_TYPE' using errcode = '22023';
  end if;

  if coalesce(p_amount_rp, 0) <= 0 then
    raise exception 'AMOUNT_MUST_BE_POSITIVE' using errcode = '22003';
  end if;

  select *
  into v_category
  from public.kas_categories
  where id = p_category_id;

  if v_category.id is null then
    raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_category.type <> p_type then
    raise exception 'CATEGORY_TYPE_MISMATCH' using errcode = '22023';
  end if;

  insert into public.kas (
    date,
    type,
    category_id,
    amount_rp,
    description,
    cycle_id,
    created_by,
    source_sale_id
  ) values (
    p_date,
    p_type,
    p_category_id,
    p_amount_rp,
    coalesce(p_description, ''),
    p_cycle_id,
    v_profile_id,
    null
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'ok', true,
    'item', (select to_jsonb(t) from public.api_v_cash_transactions_enriched t where t.transaction_id = v_transaction_id),
    'refresh', jsonb_build_array('dashboard_summary', 'cash_summary', 'cash_transactions')
  );
end;
$$;

create or replace function public.api_cash_transaction_update(
  p_transaction_id uuid,
  p_date date,
  p_type text,
  p_category_id uuid,
  p_amount_rp integer,
  p_description text default '',
  p_cycle_id uuid default null
) returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_category record;
  v_transaction record;
begin
  perform public.api_current_profile_id();

  if p_type not in ('Masuk', 'Keluar') then
    raise exception 'INVALID_CASH_TYPE' using errcode = '22023';
  end if;

  if coalesce(p_amount_rp, 0) <= 0 then
    raise exception 'AMOUNT_MUST_BE_POSITIVE' using errcode = '22003';
  end if;

  select *
  into v_transaction
  from public.kas
  where id = p_transaction_id;

  if v_transaction.id is null then
    raise exception 'TRANSACTION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_transaction.source_sale_id is not null then
    raise exception 'SALE_GENERATED_TRANSACTION_LOCKED' using errcode = '42501';
  end if;

  select *
  into v_category
  from public.kas_categories
  where id = p_category_id;

  if v_category.id is null then
    raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_category.type <> p_type then
    raise exception 'CATEGORY_TYPE_MISMATCH' using errcode = '22023';
  end if;

  update public.kas
  set
    date = p_date,
    type = p_type,
    category_id = p_category_id,
    amount_rp = p_amount_rp,
    description = coalesce(p_description, ''),
    cycle_id = p_cycle_id
  where id = p_transaction_id;

  return jsonb_build_object(
    'ok', true,
    'item', (select to_jsonb(t) from public.api_v_cash_transactions_enriched t where t.transaction_id = p_transaction_id),
    'refresh', jsonb_build_array('dashboard_summary', 'cash_summary', 'cash_transactions')
  );
end;
$$;

create or replace function public.api_cash_transaction_delete(
  p_transaction_id uuid
) returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_transaction record;
begin
  perform public.api_current_profile_id();

  select *
  into v_transaction
  from public.kas
  where id = p_transaction_id;

  if v_transaction.id is null then
    raise exception 'TRANSACTION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_transaction.source_sale_id is not null then
    raise exception 'SALE_GENERATED_TRANSACTION_LOCKED' using errcode = '42501';
  end if;

  delete from public.kas where id = p_transaction_id;

  return jsonb_build_object('ok', true, 'refresh', jsonb_build_array('dashboard_summary', 'cash_summary', 'cash_transactions'));
end;
$$;

create or replace function public.api_profile_update(
  p_language text,
  p_telegram_id text default ''
) returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.api_current_profile_id();
begin
  if p_language not in ('id', 'en') then
    raise exception 'INVALID_LANGUAGE' using errcode = '22023';
  end if;

  update public.profiles
  set
    language = p_language,
    telegram_id = nullif(btrim(coalesce(p_telegram_id, '')), '')
  where id = v_profile_id;

  return jsonb_build_object(
    'ok', true,
    'item', public.api_profile_me(),
    'refresh', jsonb_build_array('profile_me')
  );
end;
$$;

create or replace function public.api_cycle_start(
  p_unit_id uuid,
  p_fish_type_id uuid,
  p_date_start date,
  p_initial_stock integer,
  p_avg_seed_weight_g numeric default null,
  p_target_weight_g numeric default null,
  p_capital_rp integer default 0,
  p_description text default ''
) returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.api_current_profile_id();
  v_unit record;
  v_fish record;
  v_cycle_id uuid := gen_random_uuid();
  v_cycle_name text;
begin
  if coalesce(p_initial_stock, 0) <= 0 then
    raise exception 'INITIAL_STOCK_MUST_BE_POSITIVE' using errcode = '22003';
  end if;

  if coalesce(p_avg_seed_weight_g, 0) < 0
    or coalesce(p_target_weight_g, 0) < 0
    or coalesce(p_capital_rp, 0) < 0 then
    raise exception 'NEGATIVE_VALUE_NOT_ALLOWED' using errcode = '22003';
  end if;

  select * into v_unit from public.units where id = p_unit_id;
  if v_unit.id is null then
    raise exception 'POND_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_fish from public.fish_types where id = p_fish_type_id;
  if v_fish.id is null then
    raise exception 'FISH_TYPE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.cycles where unit_id = p_unit_id and date_end is null) then
    raise exception 'ACTIVE_CYCLE_EXISTS' using errcode = '23505';
  end if;

  v_cycle_name := v_unit.name || ' - ' || v_fish.name || ' ' || to_char(p_date_start, 'YYYY-MM-DD');

  insert into public.cycles (
    id,
    name,
    unit_id,
    fish_type_id,
    date_start,
    date_end,
    initial_stock,
    avg_seed_weight_g,
    target_weight_g,
    capital_rp,
    description
  ) values (
    v_cycle_id,
    v_cycle_name,
    p_unit_id,
    p_fish_type_id,
    p_date_start,
    null,
    p_initial_stock,
    p_avg_seed_weight_g,
    p_target_weight_g,
    coalesce(p_capital_rp, 0),
    coalesce(p_description, '')
  );

  update public.units
  set is_active = true
  where id = p_unit_id;

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
    source_row_id,
    created_by
  ) values (
    p_date_start,
    p_unit_id,
    p_fish_type_id,
    v_cycle_id,
    'stock_in',
    p_initial_stock,
    null,
    'Initial stock from cycle start',
    jsonb_build_object('source', 'cycle_start'),
    'manual_ui',
    v_cycle_id,
    v_profile_id
  );

  return jsonb_build_object(
    'ok', true,
    'pond_id', p_unit_id,
    'cycle_id', v_cycle_id,
    'refresh', jsonb_build_array('ponds_list', 'pond_detail', 'dashboard_summary', 'stock_movements', 'form_options')
  );
end;
$$;

create or replace function public.api_cycle_close(
  p_cycle_id uuid,
  p_date_end date,
  p_reason text default ''
) returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.api_current_profile_id();
  v_cycle record;
  v_live integer;
  v_movement_type text;
begin
  select * into v_cycle from public.cycles where id = p_cycle_id;

  if v_cycle.id is null then
    raise exception 'CYCLE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_cycle.date_end is not null then
    raise exception 'CYCLE_ALREADY_CLOSED' using errcode = '22023';
  end if;

  if p_date_end < v_cycle.date_start then
    raise exception 'INVALID_CLOSE_DATE' using errcode = '22007';
  end if;

  v_live := greatest(public.api_live_fish_for_cycle(p_cycle_id), 0);
  v_movement_type := case when coalesce(p_reason, '') ~* '(personal|konsumsi|pribadi)' then 'personal_use' else 'adjustment_out' end;

  if v_live > 0 then
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
      source_row_id,
      created_by
    ) values (
      p_date_end,
      v_cycle.unit_id,
      v_cycle.fish_type_id,
      p_cycle_id,
      v_movement_type,
      v_live,
      null,
      'Cycle close: ' || coalesce(p_reason, ''),
      jsonb_build_object('reason', coalesce(p_reason, '')),
      'manual_cycle_close',
      p_cycle_id,
      v_profile_id
    );
  end if;

  update public.cycles
  set
    date_end = p_date_end,
    description = nullif(concat_ws(E'\n', nullif(description, ''), 'Closed: ' || coalesce(p_reason, '')), '')
  where id = p_cycle_id;

  return jsonb_build_object(
    'ok', true,
    'pond_id', v_cycle.unit_id,
    'cycle_id', p_cycle_id,
    'refresh', jsonb_build_array('ponds_list', 'pond_detail', 'dashboard_summary', 'stock_movements', 'form_options')
  );
end;
$$;

create or replace function public.api_cycle_transfer(
  p_cycle_id uuid,
  p_to_unit_id uuid,
  p_date date,
  p_reason text default ''
) returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.api_current_profile_id();
  v_cycle record;
  v_target_unit record;
  v_live integer;
  v_new_cycle_id uuid := gen_random_uuid();
  v_pair_id uuid := gen_random_uuid();
begin
  select * into v_cycle from public.cycles where id = p_cycle_id;

  if v_cycle.id is null then
    raise exception 'CYCLE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_cycle.date_end is not null then
    raise exception 'CYCLE_ALREADY_CLOSED' using errcode = '22023';
  end if;

  if p_to_unit_id = v_cycle.unit_id then
    raise exception 'INVALID_TRANSFER_TARGET' using errcode = '22023';
  end if;

  if p_date < v_cycle.date_start then
    raise exception 'INVALID_TRANSFER_DATE' using errcode = '22007';
  end if;

  select * into v_target_unit from public.units where id = p_to_unit_id;
  if v_target_unit.id is null then
    raise exception 'TARGET_POND_NOT_FOUND' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.cycles where unit_id = p_to_unit_id and date_end is null) then
    raise exception 'TARGET_ACTIVE_CYCLE_EXISTS' using errcode = '23505';
  end if;

  v_live := greatest(public.api_live_fish_for_cycle(p_cycle_id), 0);
  if v_live <= 0 then
    raise exception 'NO_LIVE_STOCK_TO_TRANSFER' using errcode = '22003';
  end if;

  update public.cycles
  set
    date_end = p_date,
    description = nullif(concat_ws(E'\n', nullif(description, ''), 'Transferred to ' || v_target_unit.name || ': ' || coalesce(p_reason, '')), '')
  where id = p_cycle_id;

  insert into public.cycles (
    id,
    name,
    unit_id,
    fish_type_id,
    date_start,
    date_end,
    initial_stock,
    avg_seed_weight_g,
    target_weight_g,
    capital_rp,
    description
  ) values (
    v_new_cycle_id,
    v_cycle.name || ' - Transfer',
    p_to_unit_id,
    v_cycle.fish_type_id,
    p_date,
    null,
    v_live,
    v_cycle.avg_seed_weight_g,
    v_cycle.target_weight_g,
    0,
    'Transfer continuation from ' || v_cycle.name || '. Reason: ' || coalesce(p_reason, '')
  );

  update public.units set is_active = true where id in (v_cycle.unit_id, p_to_unit_id);

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
    source_row_id,
    created_by
  ) values
  (
    p_date,
    v_cycle.unit_id,
    v_cycle.fish_type_id,
    p_cycle_id,
    'transfer_out',
    v_live,
    null,
    'Cycle transfer out: ' || coalesce(p_reason, ''),
    jsonb_build_object('pair_id', v_pair_id, 'to_unit_id', p_to_unit_id),
    'manual_ui',
    v_pair_id,
    v_profile_id
  ),
  (
    p_date,
    p_to_unit_id,
    v_cycle.fish_type_id,
    v_new_cycle_id,
    'transfer_in',
    v_live,
    null,
    'Cycle transfer in from previous pond: ' || coalesce(p_reason, ''),
    jsonb_build_object('pair_id', v_pair_id, 'from_unit_id', v_cycle.unit_id),
    'manual_ui',
    v_pair_id,
    v_profile_id
  );

  return jsonb_build_object(
    'ok', true,
    'pond_id', p_to_unit_id,
    'cycle_id', v_new_cycle_id,
    'refresh', jsonb_build_array('ponds_list', 'pond_detail', 'dashboard_summary', 'stock_movements', 'form_options')
  );
end;
$$;

revoke all on function public.api_current_profile_id() from public;
revoke all on function public.api_live_fish_for_cycle(uuid) from public;
revoke all on function public.api_pond_create(text, text, integer, boolean, text) from public;
revoke all on function public.api_daily_log_create(date, uuid, numeric, text, text, text, numeric, integer) from public;
revoke all on function public.api_daily_log_delete(uuid) from public;
revoke all on function public.api_daily_log_update(uuid, date, numeric, text, text, text, numeric, integer) from public;
revoke all on function public.api_stock_movement_create(date, uuid, text, integer, numeric, text, uuid) from public;
revoke all on function public.api_stock_movement_delete(uuid) from public;
revoke all on function public.api_cash_transaction_create(date, text, uuid, integer, text, uuid) from public;
revoke all on function public.api_cash_transaction_update(uuid, date, text, uuid, integer, text, uuid) from public;
revoke all on function public.api_cash_transaction_delete(uuid) from public;
revoke all on function public.api_profile_update(text, text) from public;
revoke all on function public.api_cycle_start(uuid, uuid, date, integer, numeric, numeric, integer, text) from public;
revoke all on function public.api_cycle_close(uuid, date, text) from public;
revoke all on function public.api_cycle_transfer(uuid, uuid, date, text) from public;

grant execute on function public.api_daily_log_create(date, uuid, numeric, text, text, text, numeric, integer) to authenticated;
grant execute on function public.api_pond_create(text, text, integer, boolean, text) to authenticated;
grant execute on function public.api_daily_log_delete(uuid) to authenticated;
grant execute on function public.api_daily_log_update(uuid, date, numeric, text, text, text, numeric, integer) to authenticated;
grant execute on function public.api_stock_movement_create(date, uuid, text, integer, numeric, text, uuid) to authenticated;
grant execute on function public.api_stock_movement_delete(uuid) to authenticated;
grant execute on function public.api_cash_transaction_create(date, text, uuid, integer, text, uuid) to authenticated;
grant execute on function public.api_cash_transaction_update(uuid, date, text, uuid, integer, text, uuid) to authenticated;
grant execute on function public.api_cash_transaction_delete(uuid) to authenticated;
grant execute on function public.api_profile_update(text, text) to authenticated;
grant execute on function public.api_cycle_start(uuid, uuid, date, integer, numeric, numeric, integer, text) to authenticated;
grant execute on function public.api_cycle_close(uuid, date, text) to authenticated;
grant execute on function public.api_cycle_transfer(uuid, uuid, date, text) to authenticated;

commit;
