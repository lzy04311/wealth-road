-- 财记 Supabase 云同步：建表 + RLS 行级权限
-- 在 Supabase 项目的 SQL Editor 里执行一次即可（注意选择 public schema）。

-- 1. 建表：每个登录用户一行完整 state（jsonb）
create table if not exists public.user_finance_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

-- 2. 启用行级安全（RLS）
alter table public.user_finance_states enable row level security;

revoke all on table public.user_finance_states from anon;
grant select, insert, update on table public.user_finance_states to authenticated;

-- 3. 只允许登录用户读写自己的行
drop policy if exists "user_read_own_state" on public.user_finance_states;
create policy "user_read_own_state"
  on public.user_finance_states for select
  using (auth.uid() = user_id);

drop policy if exists "user_insert_own_state" on public.user_finance_states;
create policy "user_insert_own_state"
  on public.user_finance_states for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_update_own_state" on public.user_finance_states;
create policy "user_update_own_state"
  on public.user_finance_states for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. 更新时自动刷新 updated_at
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists user_finance_states_touch on public.user_finance_states;
create trigger user_finance_states_touch
  before update on public.user_finance_states
  for each row execute function public.touch_updated_at();

-- 5. 原子比较并交换（CAS）：只有远端版本仍等于客户端最后同步版本时才允许写入。
-- 首次上传要求 p_expected_updated_at 为空且云端尚无该用户记录。
create or replace function public.save_finance_state(
  p_schema_version integer,
  p_state jsonb,
  p_expected_updated_at timestamptz default null
)
returns table(updated_at timestamptz, conflict boolean)
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_updated_at timestamptz;
  saved_updated_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select row.updated_at into current_updated_at
  from public.user_finance_states as row
  where row.user_id = auth.uid()
  for update;

  if current_updated_at is null then
    if p_expected_updated_at is not null then
      return query select null::timestamptz, true;
      return;
    end if;
    insert into public.user_finance_states (user_id, schema_version, state)
    values (auth.uid(), p_schema_version, p_state)
    returning user_finance_states.updated_at into saved_updated_at;
  else
    if p_expected_updated_at is null or current_updated_at <> p_expected_updated_at then
      return query select current_updated_at, true;
      return;
    end if;
    update public.user_finance_states
    set schema_version = p_schema_version, state = p_state
    where user_id = auth.uid()
    returning user_finance_states.updated_at into saved_updated_at;
  end if;

  return query select saved_updated_at, false;
end;
$$;

revoke all on function public.save_finance_state(integer, jsonb, timestamptz) from public;
grant execute on function public.save_finance_state(integer, jsonb, timestamptz) to authenticated;
