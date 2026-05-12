-- KANIKAN Feeding V1
-- Run after:
-- 1. schema_cleanup_v1_2026_04_28.sql
-- 2. api_read_rpc_v1.sql
-- 3. api_mutation_rpc_v1.sql

create table if not exists public.feeding_schedules (
  id uuid primary key default gen_random_uuid(),
  session_label text not null unique check (session_label in ('morning', 'noon', 'evening', 'custom')),
  expected_time time,
  cutoff_time time,
  active_days integer[] not null default array[1,2,3,4,5,6,7],
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.feeding_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  session_label text check (session_label in ('morning', 'noon', 'evening', 'custom')),
  default_note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.feeding_sessions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  session_label text not null check (session_label in ('morning', 'noon', 'evening', 'custom')),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.feeding_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.feeding_sessions(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  feed_g numeric,
  input_status text not null default 'manual' check (input_status in ('manual', 'suggested_confirmed', 'estimated_unconfirmed', 'skipped')),
  suggestion_source text,
  created_at timestamptz not null default now(),
  constraint feeding_entries_feed_non_negative check (feed_g is null or feed_g >= 0),
  constraint feeding_entries_skipped_feed_null check (
    (input_status = 'skipped' and feed_g is null)
    or (input_status <> 'skipped' and coalesce(feed_g, 0) >= 0)
  ),
  unique (session_id, unit_id)
);

create index if not exists idx_feeding_sessions_date_session on public.feeding_sessions(date desc, session_label, created_at desc);
create index if not exists idx_feeding_entries_unit_created on public.feeding_entries(unit_id, created_at desc);
create index if not exists idx_feeding_entries_cycle on public.feeding_entries(cycle_id, created_at desc);

insert into public.feeding_schedules (session_label, expected_time, cutoff_time)
values
  ('morning', '08:00', '10:00'),
  ('noon', '13:00', '15:00'),
  ('evening', '18:00', '20:00')
on conflict (session_label) do update
set expected_time = excluded.expected_time,
    cutoff_time = excluded.cutoff_time,
    is_active = true;

insert into public.feeding_templates (name, session_label, default_note)
select 'Pakan normal', null, 'Nafsu makan normal'
where not exists (select 1 from public.feeding_templates where name = 'Pakan normal');

insert into public.feeding_templates (name, session_label, default_note)
select 'Pakan dikurangi', null, 'Pakan dikurangi dan perlu dipantau'
where not exists (select 1 from public.feeding_templates where name = 'Pakan dikurangi');

insert into public.feeding_templates (name, session_label, default_note)
select 'Sambil sampling', null, 'Feeding sambil cek sample'
where not exists (select 1 from public.feeding_templates where name = 'Sambil sampling');

create or replace function public.api_feeding_page(
  p_date date default current_date,
  p_session_label text default 'morning'
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_date date := coalesce(p_date, current_date);
  v_session_label text := coalesce(nullif(p_session_label, ''), 'morning');
begin
  perform public.api_require_auth();

  if v_session_label not in ('morning', 'noon', 'evening', 'custom') then
    raise exception 'INVALID_SESSION_LABEL' using errcode = '22023';
  end if;

  return (
    with active_cycles as (
      select
        u.id as pond_id,
        u.name as pond_name,
        c.id as cycle_id,
        ft.name as fish_species
      from public.units u
      join public.cycles c on c.unit_id = u.id and c.date_end is null
      left join public.fish_types ft on ft.id = c.fish_type_id
      where coalesce(u.is_active, true) = true
    ),
    history as (
      select
        fe.unit_id,
        fs.session_label,
        fe.feed_g,
        fe.created_at,
        row_number() over (partition by fe.unit_id, fs.session_label order by fs.date desc, fe.created_at desc) as rn
      from public.feeding_entries fe
      join public.feeding_sessions fs on fs.id = fe.session_id
      where fe.input_status <> 'skipped'
        and coalesce(fe.feed_g, 0) > 0
    ),
    selected_history as (
      select *
      from history
      where session_label = v_session_label
        and rn <= 5
    ),
    selected_stats as (
      select
        unit_id,
        max(feed_g) filter (where rn = 1) as last_feed_g,
        round(sum(feed_g * case rn when 1 then 5 when 2 then 3 when 3 then 2 else 1 end) / sum(case rn when 1 then 5 when 2 then 3 when 3 then 2 else 1 end)) as suggested_feed_g,
        greatest(0, round(avg(feed_g) * 0.75)) as min_feed_g,
        round(avg(feed_g) * 1.25) as max_feed_g,
        count(*) as sample_size
      from selected_history
      group by unit_id
    ),
    schedule_missing as (
      select
        v_date as date,
        fs.session_label,
        ac.pond_id,
        ac.pond_name,
        ac.cycle_id,
        ac.fish_species
      from active_cycles ac
      join public.feeding_schedules fs on fs.is_active = true
      where (
          v_date < current_date
          or fs.cutoff_time is null
          or localtime >= fs.cutoff_time
        )
        and extract(isodow from v_date)::integer = any(fs.active_days)
        and not exists (
          select 1
          from public.feeding_sessions session
          join public.feeding_entries entry on entry.session_id = session.id
          where session.date = v_date
            and session.session_label = fs.session_label
            and entry.unit_id = ac.pond_id
        )
    ),
    missing_stats as (
      select
        sm.*,
        stats.suggested_feed_g,
        stats.min_feed_g,
        stats.max_feed_g
      from schedule_missing sm
      left join lateral (
        select
          round(sum(h.feed_g * case h.rn when 1 then 5 when 2 then 3 when 3 then 2 else 1 end) / sum(case h.rn when 1 then 5 when 2 then 3 when 3 then 2 else 1 end)) as suggested_feed_g,
          greatest(0, round(avg(h.feed_g) * 0.75)) as min_feed_g,
          round(avg(h.feed_g) * 1.25) as max_feed_g
        from history h
        where h.unit_id = sm.pond_id
          and h.session_label = sm.session_label
          and h.rn <= 5
      ) stats on true
    ),
    recent_sessions as (
      select
        fs.id as session_id,
        fs.date,
        fs.session_label,
        fs.note,
        fs.created_at,
        coalesce(sum(coalesce(fe.feed_g, 0)), 0) as total_feed_g,
        count(fe.id) as entry_count,
        count(fe.id) filter (where fe.input_status = 'skipped') as skipped_count
      from public.feeding_sessions fs
      left join public.feeding_entries fe on fe.session_id = fs.id
      group by fs.id
      order by fs.date desc, fs.created_at desc
      limit 10
    )
    select jsonb_build_object(
      'date', v_date,
      'session_label', v_session_label,
      'schedules', coalesce((
        select jsonb_agg(jsonb_build_object(
          'schedule_id', id,
          'session_label', session_label,
          'expected_time', expected_time,
          'cutoff_time', cutoff_time,
          'is_active', is_active
        ) order by expected_time nulls last)
        from public.feeding_schedules
        where is_active = true
      ), '[]'::jsonb),
      'templates', coalesce((
        select jsonb_agg(jsonb_build_object(
          'template_id', id,
          'name', name,
          'session_label', session_label,
          'default_note', default_note,
          'is_active', is_active
        ) order by name)
        from public.feeding_templates
        where is_active = true
      ), '[]'::jsonb),
      'active_ponds', coalesce((
        select jsonb_agg(jsonb_build_object(
          'pond_id', ac.pond_id,
          'pond_name', ac.pond_name,
          'cycle_id', ac.cycle_id,
          'fish_species', ac.fish_species,
          'last_feed_g', ss.last_feed_g,
          'suggested_feed_g', ss.suggested_feed_g,
          'min_feed_g', ss.min_feed_g,
          'max_feed_g', ss.max_feed_g,
          'sample_size', coalesce(ss.sample_size, 0),
          'already_recorded', exists (
            select 1
            from public.feeding_sessions session
            join public.feeding_entries entry on entry.session_id = session.id
            where session.date = v_date
              and session.session_label = v_session_label
              and entry.unit_id = ac.pond_id
          )
        ) order by ac.pond_name)
        from active_cycles ac
        left join selected_stats ss on ss.unit_id = ac.pond_id
      ), '[]'::jsonb),
      'missing_items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', 'missing-feeding-' || ms.date::text || '-' || ms.session_label || '-' || ms.pond_id::text,
          'date', ms.date,
          'session_label', ms.session_label,
          'pond_id', ms.pond_id,
          'pond_name', ms.pond_name,
          'cycle_id', ms.cycle_id,
          'fish_species', ms.fish_species,
          'suggested_feed_g', ms.suggested_feed_g,
          'min_feed_g', ms.min_feed_g,
          'max_feed_g', ms.max_feed_g
        ) order by ms.date desc, ms.session_label, ms.pond_name)
        from missing_stats ms
      ), '[]'::jsonb),
      'recent_sessions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'session_id', session_id,
          'date', date,
          'session_label', session_label,
          'note', note,
          'total_feed_g', total_feed_g,
          'entry_count', entry_count,
          'skipped_count', skipped_count,
          'created_at', created_at
        ))
        from recent_sessions
      ), '[]'::jsonb)
    )
  );
end;
$$;

create or replace function public.api_feeding_session_create(
  p_date date,
  p_session_label text,
  p_note text default '',
  p_entries jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.api_current_profile_id();
  v_session_id uuid;
  v_entry jsonb;
  v_unit_id uuid;
  v_cycle_id uuid;
  v_feed_g numeric;
  v_status text;
  v_created_count integer := 0;
begin
  if coalesce(p_session_label, '') not in ('morning', 'noon', 'evening', 'custom') then
    raise exception 'INVALID_SESSION_LABEL' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_entries, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_entries, '[]'::jsonb)) = 0 then
    raise exception 'FEEDING_ENTRIES_REQUIRED' using errcode = '22023';
  end if;

  insert into public.feeding_sessions(date, session_label, note, created_by)
  values (p_date, p_session_label, nullif(btrim(coalesce(p_note, '')), ''), v_profile_id)
  returning id into v_session_id;

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    v_unit_id := nullif(v_entry->>'unit_id', '')::uuid;
    v_status := coalesce(nullif(v_entry->>'input_status', ''), 'manual');
    v_feed_g := nullif(v_entry->>'feed_g', '')::numeric;

    if v_status not in ('manual', 'suggested_confirmed', 'estimated_unconfirmed', 'skipped') then
      raise exception 'INVALID_INPUT_STATUS' using errcode = '22023';
    end if;

    if v_status = 'skipped' then
      v_feed_g := null;
    elsif coalesce(v_feed_g, 0) <= 0 then
      raise exception 'FEEDING_AMOUNT_REQUIRED' using errcode = '22003';
    end if;

    if coalesce(v_feed_g, 0) < 0 then
      raise exception 'NEGATIVE_VALUE_NOT_ALLOWED' using errcode = '22003';
    end if;

    select c.id
    into v_cycle_id
    from public.cycles c
    join public.units u on u.id = c.unit_id
    where c.unit_id = v_unit_id
      and c.date_end is null
      and coalesce(u.is_active, true) = true
    limit 1;

    if v_cycle_id is null then
      raise exception 'NO_ACTIVE_CYCLE' using errcode = 'P0001';
    end if;

    insert into public.feeding_entries(session_id, unit_id, cycle_id, feed_g, input_status, suggestion_source)
    values (
      v_session_id,
      v_unit_id,
      v_cycle_id,
      v_feed_g,
      v_status,
      case
        when v_status in ('suggested_confirmed', 'estimated_unconfirmed') then 'weighted_recent_same_session'
        else null
      end
    );

    v_created_count := v_created_count + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'item', jsonb_build_object('session_id', v_session_id, 'entry_count', v_created_count),
    'refresh', jsonb_build_array('feeding_page', 'dashboard_summary')
  );
end;
$$;

revoke all on function public.api_feeding_page(date, text) from public;
revoke all on function public.api_feeding_session_create(date, text, text, jsonb) from public;

grant execute on function public.api_feeding_page(date, text) to authenticated;
grant execute on function public.api_feeding_session_create(date, text, text, jsonb) to authenticated;
