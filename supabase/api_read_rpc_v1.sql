-- KANIKAN API Read RPC V1
-- Run after the schema cleanup migration.
--
-- This file creates the backend read layer used by the web app:
-- helper views + Supabase RPC functions returning JSONB shaped exactly for
-- docs/API_CONTRACT_V1.md.

begin;

-- Keep sale-generated cash traceability available for the API contract.
alter table public.kas
  add column if not exists source_sale_id uuid;

do $$
begin
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

create index if not exists idx_kas_source_sale_id
on public.kas (source_sale_id);

create or replace function public.api_require_auth()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  return v_user_id;
end;
$$;

create or replace function public.api_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'owner'
  );
$$;

drop view if exists public.api_v_cash_daily_balance cascade;
drop view if exists public.api_v_daily_logs_enriched cascade;
drop view if exists public.api_v_cash_transactions_enriched cascade;
drop view if exists public.api_v_stock_movements_enriched cascade;
drop view if exists public.api_v_pond_cards cascade;
drop view if exists public.api_v_latest_weight_per_cycle cascade;
drop view if exists public.api_v_latest_log_per_cycle cascade;
drop view if exists public.api_v_cycle_stock_totals cascade;
drop view if exists public.api_v_current_cycles cascade;

create view public.api_v_current_cycles as
select
  c.id as cycle_id,
  c.name as cycle_name,
  c.unit_id,
  u.name as unit_name,
  c.fish_type_id,
  ft.name as fish_species,
  c.date_start,
  c.date_end,
  coalesce(c.initial_stock, 0) as initial_stock,
  c.target_weight_g,
  c.avg_seed_weight_g,
  coalesce(c.capital_rp, 0) as capital_rp,
  c.description,
  greatest((current_date - c.date_start), 0) as days_since_stocking
from public.cycles c
join public.units u on u.id = c.unit_id
left join public.fish_types ft on ft.id = c.fish_type_id
where c.date_end is null;

create view public.api_v_cycle_stock_totals as
select
  c.id as cycle_id,
  coalesce(sum(sm.count) filter (where sm.movement_type = 'stock_in'), 0)::integer as stock_in_count,
  coalesce(sum(sm.count) filter (where sm.movement_type = 'sold'), 0)::integer as sold_count,
  coalesce(sum(sm.count) filter (where sm.movement_type = 'died'), 0)::integer as died_count,
  coalesce(sum(sm.count) filter (where sm.movement_type = 'transfer_in'), 0)::integer as transfer_in_count,
  coalesce(sum(sm.count) filter (where sm.movement_type = 'transfer_out'), 0)::integer as transfer_out_count,
  coalesce(sum(sm.count) filter (where sm.movement_type = 'adjustment_in'), 0)::integer as adjustment_in_count,
  coalesce(sum(sm.count) filter (where sm.movement_type = 'adjustment_out'), 0)::integer as adjustment_out_count,
  coalesce(sum(sm.count) filter (where sm.movement_type = 'personal_use'), 0)::integer as personal_use_count,
  (
    coalesce(sum(sm.count) filter (where sm.movement_type in ('stock_in', 'transfer_in', 'adjustment_in')), 0)
    - coalesce(sum(sm.count) filter (where sm.movement_type in ('sold', 'died', 'transfer_out', 'adjustment_out', 'personal_use')), 0)
  )::integer as live_fish_count
from public.cycles c
left join public.stock_movements sm on sm.cycle_id = c.id
group by c.id;

create view public.api_v_latest_log_per_cycle as
select distinct on (lh.cycle_id)
  lh.cycle_id,
  lh.unit_id,
  lh.id as log_id,
  lh.date,
  lh.created_at,
  coalesce(lh.feed_g, 0) as feed_g,
  lh.sample_weight_g,
  lh.sample_count,
  lh.description
from public.log_harian lh
where lh.cycle_id is not null
order by lh.cycle_id, lh.date desc, lh.created_at desc, lh.id desc;

create view public.api_v_latest_weight_per_cycle as
select distinct on (lh.cycle_id)
  lh.cycle_id,
  lh.sample_weight_g,
  lh.sample_count,
  lh.date,
  lh.created_at
from public.log_harian lh
where lh.cycle_id is not null
  and lh.sample_weight_g is not null
order by lh.cycle_id, lh.date desc, lh.created_at desc, lh.id desc;

create view public.api_v_pond_cards as
select
  u.id as pond_id,
  u.name as pond_name,
  u.type as pond_type,
  u.capacity as capacity_fish,
  case when u.is_active then 'active' else 'inactive' end as pond_status,
  u.description,
  cc.cycle_id,
  cc.cycle_name,
  cc.fish_type_id,
  cc.fish_species,
  cc.date_start,
  cc.days_since_stocking,
  coalesce(st.live_fish_count, 0) as live_fish_count,
  case
    when coalesce(cc.initial_stock, 0) > 0 then round((coalesce(st.live_fish_count, 0)::numeric / cc.initial_stock::numeric) * 100, 1)
    else null
  end as survival_rate_pct,
  lw.sample_weight_g as avg_weight_g,
  cc.target_weight_g,
  case
    when lw.sample_weight_g is not null then round((coalesce(st.live_fish_count, 0)::numeric * lw.sample_weight_g) / 1000, 1)
    else null
  end as biomass_kg
from public.units u
left join public.api_v_current_cycles cc on cc.unit_id = u.id
left join public.api_v_cycle_stock_totals st on st.cycle_id = cc.cycle_id
left join public.api_v_latest_weight_per_cycle lw on lw.cycle_id = cc.cycle_id;

create view public.api_v_stock_movements_enriched as
select
  sm.id as movement_id,
  sm.date,
  sm.unit_id,
  u.name as pond_name,
  sm.cycle_id,
  c.name as cycle_name,
  sm.fish_type_id,
  ft.name as fish_species,
  sm.movement_type,
  case sm.movement_type
    when 'stock_in' then 'In'
    when 'sold' then 'Sold'
    when 'died' then 'Died'
    when 'transfer_in' then 'Transfer in'
    when 'transfer_out' then 'Transfer out'
    when 'adjustment_in' then 'Adjustment in'
    when 'adjustment_out' then 'Adjustment out'
    when 'personal_use' then 'Personal use'
    else sm.movement_type
  end as movement_label,
  case
    when sm.movement_type in ('stock_in', 'transfer_in', 'adjustment_in') then 'in'
    else 'out'
  end as direction,
  coalesce(sm.count, 0) as count,
  sm.weight_kg,
  sm.description,
  sm.source_table,
  sm.source_row_id,
  (sm.source_table is null or sm.source_table = 'manual_ui') as can_delete,
  sm.created_by,
  p.full_name as created_by_name,
  sm.created_at
from public.stock_movements sm
left join public.units u on u.id = sm.unit_id
left join public.cycles c on c.id = sm.cycle_id
left join public.fish_types ft on ft.id = sm.fish_type_id
left join public.profiles p on p.id = sm.created_by;

create view public.api_v_cash_transactions_enriched as
select
  k.id as transaction_id,
  k.date,
  k.type,
  k.category_id,
  kc.name as category_name,
  k.description,
  k.amount_rp,
  k.cycle_id,
  k.source_sale_id,
  (k.source_sale_id is null) as can_delete,
  k.created_by,
  p.full_name as created_by_name,
  k.created_at
from public.kas k
left join public.kas_categories kc on kc.id = k.category_id
left join public.profiles p on p.id = k.created_by;

create view public.api_v_daily_logs_enriched as
select
  lh.id as log_id,
  lh.date,
  lh.unit_id,
  u.name as pond_name,
  lh.cycle_id,
  c.name as cycle_name,
  lh.fish_type_id,
  ft.name as fish_species,
  coalesce(lh.feed_g, 0) as feed_g,
  lh.event,
  lh.action,
  lh.description,
  lh.sample_weight_g,
  lh.sample_count,
  lh.created_by,
  p.full_name as created_by_name,
  lh.created_at,
  (public.api_is_owner() or lh.created_by = auth.uid()) as can_delete,
  (public.api_is_owner() or lh.created_by = auth.uid()) as can_update
from public.log_harian lh
left join public.units u on u.id = lh.unit_id
left join public.cycles c on c.id = lh.cycle_id
left join public.fish_types ft on ft.id = lh.fish_type_id
left join public.profiles p on p.id = lh.created_by;

create view public.api_v_cash_daily_balance as
select
  k.date,
  coalesce(sum(k.amount_rp) filter (where k.type = 'Masuk'), 0)::bigint as income_rp,
  coalesce(sum(k.amount_rp) filter (where k.type = 'Keluar'), 0)::bigint as outcome_rp,
  (
    coalesce(sum(k.amount_rp) filter (where k.type = 'Masuk'), 0)
    - coalesce(sum(k.amount_rp) filter (where k.type = 'Keluar'), 0)
  )::bigint as net_rp,
  (
    coalesce(sum(k.amount_rp) filter (where k.type = 'Masuk'), 0)
    - coalesce(sum(k.amount_rp) filter (where k.type = 'Keluar'), 0)
  )::bigint as daily_balance_delta_rp
from public.kas k
group by k.date;

create or replace function public.api_ponds_list(
  p_include_inactive boolean default true,
  p_q text default null
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with auth_check as (
    select public.api_require_auth()
  ),
  base as (
    select *
    from public.api_v_pond_cards pc
    where (p_include_inactive or pc.pond_status = 'active')
      and (p_q is null or pc.pond_name ilike '%' || p_q || '%')
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'total_ponds', coalesce((select count(*) from base), 0),
      'active_ponds', coalesce((select count(*) from base where cycle_id is not null), 0),
      'empty_ponds', coalesce((select count(*) from base where cycle_id is null), 0)
    ),
    'ponds', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'pond_id', pond_id,
            'pond_name', pond_name,
            'pond_type', pond_type,
            'capacity_fish', capacity_fish,
            'status', pond_status,
            'description', description,
            'current_cycle', case
              when cycle_id is null then null
              else jsonb_build_object(
                'cycle_id', cycle_id,
                'cycle_name', cycle_name,
                'fish_species', fish_species,
                'date_start', date_start,
                'days_since_stocking', days_since_stocking
              )
            end
          )
          order by pond_name
        )
        from base
      ),
      '[]'::jsonb
    )
  )
  from auth_check;
$$;

create or replace function public.api_pond_detail(
  p_pond_id uuid,
  p_logs_limit integer default 30,
  p_stock_limit integer default 30
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with auth_check as (
    select public.api_require_auth()
  ),
  pond as (
    select *
    from public.api_v_pond_cards
    where pond_id = p_pond_id
    limit 1
  ),
  latest_log as (
    select ll.*
    from public.api_v_latest_log_per_cycle ll
    join pond p on p.cycle_id = ll.cycle_id
    limit 1
  ),
  current_cycle as (
    select
      p.*,
      c.initial_stock,
      ll.log_id,
      ll.date as last_log_date,
      ll.created_at as last_log_created_at
    from pond p
    left join public.cycles c on c.id = p.cycle_id
    left join latest_log ll on true
  )
  select jsonb_build_object(
    'pond', (
      select jsonb_build_object(
        'pond_id', pond_id,
        'pond_name', pond_name,
        'pond_type', pond_type,
        'capacity_fish', capacity_fish,
        'status', pond_status,
        'description', description
      )
      from pond
    ),
    'current_cycle', (
      select case
        when cycle_id is null then null
        else jsonb_build_object(
          'cycle_id', cycle_id,
          'cycle_name', cycle_name,
          'status', 'running',
          'fish_species', fish_species,
          'date_start', date_start,
          'days_since_stocking', days_since_stocking,
          'initial_stock_count', coalesce(initial_stock, 0),
          'live_fish_count', live_fish_count,
          'survival_rate_pct', survival_rate_pct,
          'avg_weight_g', avg_weight_g,
          'target_weight_g', target_weight_g,
          'target_progress_pct', case
            when target_weight_g is not null and target_weight_g > 0 and avg_weight_g is not null
              then round((avg_weight_g / target_weight_g) * 100, 1)
            else null
          end,
          'harvest_prediction', case
            when target_weight_g is not null and avg_weight_g is not null and target_weight_g > avg_weight_g
              then jsonb_build_object('days_left', null, 'label', 'N/A')
            else jsonb_build_object('days_left', 0, 'label', 'Ready or N/A')
          end,
          'last_log', case
            when log_id is null then null
            else jsonb_build_object(
              'log_id', log_id,
              'logged_at', last_log_created_at,
              'date', last_log_date,
              'relative_label', case
                when current_date - last_log_date = 0 then 'Hari ini'
                when current_date - last_log_date = 1 then '1 hari yang lalu'
                else (current_date - last_log_date)::text || ' hari yang lalu'
              end
            )
          end
        )
      end
      from current_cycle
    ),
    'daily_logs', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'log_id', log_id,
            'date', date,
            'logged_at', created_at,
            'feed_g', feed_g,
            'sample_weight_g', sample_weight_g,
            'sample_count', sample_count,
            'event', event,
            'action', action,
            'description', description,
            'created_by', case
              when created_by is null then null
              else jsonb_build_object('profile_id', created_by, 'name', created_by_name)
            end,
            'can_update', can_update,
            'can_delete', can_delete
          )
          order by date desc, created_at desc
        )
        from (
          select *
          from public.api_v_daily_logs_enriched
          where unit_id = p_pond_id
          order by date desc, created_at desc
          limit greatest(coalesce(p_logs_limit, 30), 0)
        ) logs
      ),
      '[]'::jsonb
    ),
    'stock_movements', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'movement_id', movement_id,
            'date', date,
            'movement_type', movement_type,
            'movement_label', movement_label,
            'count', count,
            'weight_kg', weight_kg,
            'description', description,
            'created_at', created_at,
            'can_delete', can_delete
          )
          order by date desc, created_at desc
        )
        from (
          select *
          from public.api_v_stock_movements_enriched
          where unit_id = p_pond_id
          order by date desc, created_at desc
          limit greatest(coalesce(p_stock_limit, 30), 0)
        ) movements
      ),
      '[]'::jsonb
    ),
    'cycle_history', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'cycle_id', c.id,
            'cycle_name', c.name,
            'fish_species', ft.name,
            'date_start', c.date_start,
            'date_end', c.date_end,
            'initial_stock_count', coalesce(c.initial_stock, 0),
            'status', case when c.date_end is null then 'running' else 'closed' end
          )
          order by c.date_start desc, c.created_at desc
        )
        from public.cycles c
        left join public.fish_types ft on ft.id = c.fish_type_id
        where c.unit_id = p_pond_id
      ),
      '[]'::jsonb
    )
  )
  from auth_check;
$$;

create or replace function public.api_dashboard_summary(
  p_date date default current_date,
  p_period_start date default null,
  p_period_end date default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_date date := coalesce(p_date, current_date);
  v_end date := coalesce(p_period_end, coalesce(p_date, current_date));
  v_start date := coalesce(p_period_start, coalesce(p_period_end, coalesce(p_date, current_date)) - 6);
  v_month_start date;
  v_month_end date;
  v_feed_today numeric;
  v_feed_target numeric;
  v_live_count numeric;
  v_initial_count numeric;
  v_died_count numeric;
  v_sales_rp bigint;
  v_expense_rp bigint;
begin
  perform public.api_require_auth();

  v_month_start := date_trunc('month', v_date)::date;
  v_month_end := (v_month_start + interval '1 month')::date;

  select coalesce(sum(feed_g), 0)
  into v_feed_today
  from public.log_harian
  where date = v_date;

  select coalesce(sum(feed_g), 0) / greatest((v_end - v_start + 1), 1)
  into v_feed_target
  from public.log_harian
  where date between v_start and v_end;

  select
    coalesce(sum(st.live_fish_count), 0),
    coalesce(sum(cc.initial_stock), 0)
  into v_live_count, v_initial_count
  from public.api_v_current_cycles cc
  left join public.api_v_cycle_stock_totals st on st.cycle_id = cc.cycle_id;

  select coalesce(sum(count), 0)
  into v_died_count
  from public.stock_movements
  where movement_type = 'died'
    and date between v_start and v_end;

  select coalesce(sum(total_rp), 0)::bigint
  into v_sales_rp
  from public.penjualan
  where date >= v_month_start
    and date < v_month_end;

  select coalesce(sum(amount_rp), 0)::bigint
  into v_expense_rp
  from public.kas
  where type = 'Keluar'
    and date >= v_month_start
    and date < v_month_end;

  return jsonb_build_object(
    'as_of_date', v_date,
    'period', jsonb_build_object(
      'start', v_start,
      'end', v_end,
      'label', 'Selected period'
    ),
    'kpis', jsonb_build_object(
      'running_ponds', (select count(*) from public.api_v_current_cycles),
      'feed_today_g', coalesce(v_feed_today, 0),
      'feed_target_g', coalesce(round(v_feed_target, 1), 0),
      'feed_today_vs_target_pct', case when v_feed_target > 0 then round((v_feed_today / v_feed_target) * 100, 1) else 0 end,
      'feed_calculation_note', 'Total feed logged today divided by average daily feed from the selected period.',
      'survival_rate_pct', case when v_initial_count > 0 then round((v_live_count / v_initial_count) * 100, 1) else 0 end,
      'mortality_this_week_pct', case when (v_live_count + v_died_count) > 0 then round((v_died_count / (v_live_count + v_died_count)) * 100, 1) else 0 end,
      'mortality_this_week_count', coalesce(v_died_count, 0)
    ),
    'attention_items', coalesce(
      (
        select jsonb_agg(item)
        from (
          select jsonb_build_object(
            'id', 'missing-log-' || pc.pond_id::text,
            'tone', 'warning',
            'pond_id', pc.pond_id,
            'pond_name', pc.pond_name,
            'title', pc.pond_name || ' needs a daily log today',
            'description', 'Open the pond and add today feed plus a short daily note.',
            'action_label', 'Add log'
          ) as item
          from public.api_v_pond_cards pc
          where pc.cycle_id is not null
            and not exists (
              select 1
              from public.log_harian lh
              where lh.cycle_id = pc.cycle_id
                and lh.date = v_date
            )
          union all
          select jsonb_build_object(
            'id', 'missing-target-' || pc.cycle_id::text,
            'tone', 'info',
            'pond_id', pc.pond_id,
            'pond_name', pc.pond_name,
            'cycle_id', pc.cycle_id,
            'title', pc.pond_name || ' needs target weight',
            'description', 'Add target weight so growth and harvest prediction are clearer.',
            'action_label', 'Review cycle'
          ) as item
          from public.api_v_pond_cards pc
          where pc.cycle_id is not null
            and pc.target_weight_g is null
        ) attention
      ),
      '[]'::jsonb
    ),
    'growth', jsonb_build_object(
      'scope', 'overall_running_ponds',
      'title', 'Overall growth',
      'subtitle', 'Average sample weight across running ponds.',
      'points', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object('date', x.date, 'avg_weight_g', x.avg_weight_g)
            order by x.date
          )
          from (
            select lh.date, round(avg(lh.sample_weight_g), 1) as avg_weight_g
            from public.log_harian lh
            join public.api_v_current_cycles cc on cc.cycle_id = lh.cycle_id
            where lh.sample_weight_g is not null
              and lh.date between v_start and v_end
            group by lh.date
          ) x
        ),
        '[]'::jsonb
      )
    ),
    'money_snapshot', jsonb_build_object(
      'sales_this_month_rp', v_sales_rp,
      'expense_this_month_rp', v_expense_rp,
      'net_this_month_rp', v_sales_rp - v_expense_rp
    ),
    'pond_overview', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'pond_id', pond_id,
            'pond_name', pond_name,
            'cycle_id', cycle_id,
            'fish_species', fish_species,
            'days_since_stocking', days_since_stocking,
            'live_fish_count', live_fish_count,
            'survival_rate_pct', survival_rate_pct,
            'avg_weight_g', avg_weight_g,
            'status', case
              when live_fish_count < 0 then 'danger'
              when survival_rate_pct is not null and survival_rate_pct < 85 then 'danger'
              when avg_weight_g is null then 'warning'
              else 'healthy'
            end
          )
          order by pond_name
        )
        from public.api_v_pond_cards
        where cycle_id is not null
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.api_stock_movements(
  p_period text default '30d',
  p_start_date date default null,
  p_end_date date default null,
  p_pond_id text default 'all',
  p_type text default 'all',
  p_limit integer default 50,
  p_cursor text default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_end date := coalesce(p_end_date, current_date);
  v_start date;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(nullif(p_cursor, '')::integer, 0), 0);
  v_total integer;
begin
  perform public.api_require_auth();

  v_start := coalesce(
    p_start_date,
    case p_period
      when 'today' then v_end
      when '7d' then v_end - 6
      when '30d' then v_end - 29
      when 'month' then date_trunc('month', v_end)::date
      when '3m' then (v_end - interval '3 months')::date
      when 'all' then date '1900-01-01'
      else v_end - 29
    end
  );

  with filtered as (
    select *
    from public.api_v_stock_movements_enriched sm
    where sm.date between v_start and v_end
      and (coalesce(p_pond_id, 'all') = 'all' or sm.unit_id::text = p_pond_id)
      and (
        coalesce(p_type, 'all') = 'all'
        or (p_type = 'in' and sm.movement_type = 'stock_in')
        or (p_type = 'sold' and sm.movement_type = 'sold')
        or (p_type = 'died' and sm.movement_type = 'died')
        or (p_type = 'transfer' and sm.movement_type in ('transfer_in', 'transfer_out'))
      )
  )
  select count(*) into v_total from filtered;

  return jsonb_build_object(
    'period', jsonb_build_object('start', v_start, 'end', v_end, 'label', p_period),
    'pond_cards', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'pond_id', pond_id,
            'pond_name', pond_name,
            'status', pond_status,
            'fish_species', fish_species,
            'current_stock_count', live_fish_count,
            'biomass_kg', biomass_kg,
            'avg_weight_g', avg_weight_g
          )
          order by pond_name
        )
        from public.api_v_pond_cards
      ),
      '[]'::jsonb
    ),
    'filters', jsonb_build_object(
      'ponds', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object('pond_id', pond_id, 'pond_name', pond_name)
            order by sort_order, pond_name
          )
          from (
            select 'all'::text as pond_id, 'All Ponds'::text as pond_name, 0 as sort_order
            union all
            select id::text, name, 1
            from public.units
          ) ponds
        ),
        '[]'::jsonb
      ),
      'types', jsonb_build_array(
        jsonb_build_object('value', 'all', 'label', 'All'),
        jsonb_build_object('value', 'in', 'label', 'In'),
        jsonb_build_object('value', 'sold', 'label', 'Sold'),
        jsonb_build_object('value', 'died', 'label', 'Died'),
        jsonb_build_object('value', 'transfer', 'label', 'Transfer')
      )
    ),
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'movement_id', movement_id,
            'date', date,
            'pond_id', unit_id,
            'pond_name', pond_name,
            'cycle_id', cycle_id,
            'cycle_name', cycle_name,
            'fish_species', fish_species,
            'movement_type', movement_type,
            'movement_label', movement_label,
            'direction', direction,
            'count', count,
            'weight_kg', weight_kg,
            'description', description,
            'created_at', created_at,
            'can_delete', can_delete
          )
          order by date desc, created_at desc, movement_id desc
        )
        from (
          select *
          from public.api_v_stock_movements_enriched sm
          where sm.date between v_start and v_end
            and (coalesce(p_pond_id, 'all') = 'all' or sm.unit_id::text = p_pond_id)
            and (
              coalesce(p_type, 'all') = 'all'
              or (p_type = 'in' and sm.movement_type = 'stock_in')
              or (p_type = 'sold' and sm.movement_type = 'sold')
              or (p_type = 'died' and sm.movement_type = 'died')
              or (p_type = 'transfer' and sm.movement_type in ('transfer_in', 'transfer_out'))
            )
          order by sm.date desc, sm.created_at desc, sm.movement_id desc
          limit v_limit
          offset v_offset
        ) page
      ),
      '[]'::jsonb
    ),
    'next_cursor', case when v_total > v_offset + v_limit then (v_offset + v_limit)::text else null end
  );
end;
$$;

create or replace function public.api_cash_summary(
  p_month text
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_month_start date;
  v_month_end date;
  v_opening bigint;
  v_income bigint;
  v_outcome bigint;
  v_net bigint;
begin
  perform public.api_require_auth();

  if p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'INVALID_MONTH' using errcode = '22007';
  end if;

  v_month_start := to_date(p_month || '-01', 'YYYY-MM-DD');
  v_month_end := (v_month_start + interval '1 month')::date;

  select coalesce(sum(case when type = 'Masuk' then amount_rp else -amount_rp end), 0)::bigint
  into v_opening
  from public.kas
  where date < v_month_start;

  select
    coalesce(sum(amount_rp) filter (where type = 'Masuk'), 0)::bigint,
    coalesce(sum(amount_rp) filter (where type = 'Keluar'), 0)::bigint
  into v_income, v_outcome
  from public.kas
  where date >= v_month_start
    and date < v_month_end;

  v_net := v_income - v_outcome;

  return jsonb_build_object(
    'month', p_month,
    'period', jsonb_build_object(
      'start', v_month_start,
      'end', (v_month_end - 1),
      'label', to_char(v_month_start, 'DD Mon') || ' - ' || to_char(v_month_end - 1, 'DD Mon'),
      'is_current_month', date_trunc('month', current_date)::date = v_month_start
    ),
    'summary', jsonb_build_object(
      'opening_balance_rp', v_opening,
      'ending_balance_rp', v_opening + v_net,
      'income_rp', v_income,
      'outcome_rp', v_outcome,
      'net_rp', v_net
    ),
    'balance_points', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'date', date,
            'balance_rp', v_opening + running_net,
            'income_rp', income_rp,
            'outcome_rp', outcome_rp,
            'net_rp', net_rp
          )
          order by date
        )
        from (
          select
            date,
            income_rp,
            outcome_rp,
            net_rp,
            sum(net_rp) over (order by date rows between unbounded preceding and current row) as running_net
          from public.api_v_cash_daily_balance
          where date >= v_month_start
            and date < v_month_end
        ) points
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.api_cash_transactions(
  p_month text,
  p_type text default null,
  p_category_id uuid default null,
  p_limit integer default 50,
  p_cursor text default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_month_start date;
  v_month_end date;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(nullif(p_cursor, '')::integer, 0), 0);
  v_total integer;
begin
  perform public.api_require_auth();

  if p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'INVALID_MONTH' using errcode = '22007';
  end if;

  v_month_start := to_date(p_month || '-01', 'YYYY-MM-DD');
  v_month_end := (v_month_start + interval '1 month')::date;

  select count(*)
  into v_total
  from public.api_v_cash_transactions_enriched tx
  where tx.date >= v_month_start
    and tx.date < v_month_end
    and (p_type is null or tx.type = p_type)
    and (p_category_id is null or tx.category_id = p_category_id);

  return jsonb_build_object(
    'month', p_month,
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'transaction_id', transaction_id,
            'date', date,
            'type', type,
            'category_id', category_id,
            'category_name', category_name,
            'description', description,
            'amount_rp', amount_rp,
            'cycle_id', cycle_id,
            'source_sale_id', source_sale_id,
            'created_by', case
              when created_by is null then null
              else jsonb_build_object('profile_id', created_by, 'name', created_by_name)
            end,
            'can_delete', can_delete
          )
          order by date desc, created_at desc, transaction_id desc
        )
        from (
          select *
          from public.api_v_cash_transactions_enriched tx
          where tx.date >= v_month_start
            and tx.date < v_month_end
            and (p_type is null or tx.type = p_type)
            and (p_category_id is null or tx.category_id = p_category_id)
          order by tx.date desc, tx.created_at desc, tx.transaction_id desc
          limit v_limit
          offset v_offset
        ) page
      ),
      '[]'::jsonb
    ),
    'next_cursor', case when v_total > v_offset + v_limit then (v_offset + v_limit)::text else null end
  );
end;
$$;

create or replace function public.api_cash_categories(
  p_type text default null
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with auth_check as (
    select public.api_require_auth()
  )
  select jsonb_build_object(
    'items', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'category_id', id,
          'type', type,
          'name', name,
          'sort_order', coalesce(sort_order, 0)
        )
        order by type, sort_order, name
      ),
      '[]'::jsonb
    )
  )
  from auth_check, public.kas_categories
  where p_type is null or type = p_type;
$$;

create or replace function public.api_form_options()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with auth_check as (
    select public.api_require_auth()
  )
  select jsonb_build_object(
    'active_ponds', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'pond_id', pond_id,
            'pond_name', pond_name,
            'cycle_id', cycle_id,
            'cycle_name', cycle_name,
            'fish_type_id', fish_type_id,
            'fish_species', fish_species
          )
          order by pond_name
        )
        from public.api_v_pond_cards
        where cycle_id is not null
      ),
      '[]'::jsonb
    ),
    'all_ponds', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'pond_id', id,
            'pond_name', name,
            'status', case when is_active then 'active' else 'inactive' end
          )
          order by name
        )
        from public.units
      ),
      '[]'::jsonb
    ),
    'fish_types', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('fish_type_id', id, 'name', name)
          order by name
        )
        from public.fish_types
      ),
      '[]'::jsonb
    ),
    'cash_categories', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'category_id', id,
            'type', type,
            'name', name,
            'sort_order', coalesce(sort_order, 0)
          )
          order by type, sort_order, name
        )
        from public.kas_categories
      ),
      '[]'::jsonb
    )
  )
  from auth_check;
$$;

create or replace function public.api_profile_me()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with current_user_id as (
    select public.api_require_auth() as user_id
  )
  select jsonb_build_object(
    'profile_id', p.id,
    'full_name', p.full_name,
    'email', au.email,
    'role', p.role,
    'language', p.language,
    'telegram_id', case when p.telegram_id is null then '' else p.telegram_id::text end
  )
  from current_user_id u
  join public.profiles p on p.id = u.user_id
  left join auth.users au on au.id = p.id;
$$;

revoke all on function public.api_require_auth() from public;
revoke all on function public.api_is_owner() from public;
revoke all on function public.api_ponds_list(boolean, text) from public;
revoke all on function public.api_pond_detail(uuid, integer, integer) from public;
revoke all on function public.api_dashboard_summary(date, date, date) from public;
revoke all on function public.api_stock_movements(text, date, date, text, text, integer, text) from public;
revoke all on function public.api_cash_summary(text) from public;
revoke all on function public.api_cash_transactions(text, text, uuid, integer, text) from public;
revoke all on function public.api_cash_categories(text) from public;
revoke all on function public.api_form_options() from public;
revoke all on function public.api_profile_me() from public;

grant execute on function public.api_ponds_list(boolean, text) to authenticated;
grant execute on function public.api_pond_detail(uuid, integer, integer) to authenticated;
grant execute on function public.api_dashboard_summary(date, date, date) to authenticated;
grant execute on function public.api_stock_movements(text, date, date, text, text, integer, text) to authenticated;
grant execute on function public.api_cash_summary(text) to authenticated;
grant execute on function public.api_cash_transactions(text, text, uuid, integer, text) to authenticated;
grant execute on function public.api_cash_categories(text) to authenticated;
grant execute on function public.api_form_options() to authenticated;
grant execute on function public.api_profile_me() to authenticated;

commit;
