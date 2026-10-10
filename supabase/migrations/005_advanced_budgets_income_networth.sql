-- 005: advanced budgets, income sources, net worth snapshots. Additive and idempotent.
alter table public.budgets add column if not exists kind text not null default 'personal';
alter table public.budgets add column if not exists description text;
alter table public.budgets add column if not exists organisation text;
alter table public.budgets add column if not exists contingency_pct numeric(5,2) not null default 0;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='budgets_kind_check') then
    alter table public.budgets add constraint budgets_kind_check check (kind in ('personal','household','business','project','event'));
  end if;
  if not exists (select 1 from pg_constraint where conname='budgets_contingency_check') then
    alter table public.budgets add constraint budgets_contingency_check check (contingency_pct between 0 and 100);
  end if;
end $$;

alter table public.planned_categories add column if not exists cost_type text not null default 'variable';
do $$ begin
  if not exists (select 1 from pg_constraint where conname='planned_categories_cost_type_check') then
    alter table public.planned_categories add constraint planned_categories_cost_type_check check (cost_type in ('fixed','variable','capital'));
  end if;
end $$;

alter table public.assets add column if not exists cost_basis numeric(14,2);

create table if not exists public.budget_income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  budget_id uuid not null references public.budgets(id) on delete cascade,
  name text not null,
  amount numeric(14,2) not null,
  created_at timestamptz default now()
);
create index if not exists budget_income_budget_idx on public.budget_income(budget_id);

create table if not exists public.income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(14,2) not null,
  cycle text not null default 'monthly',
  next_date date not null,
  status text not null default 'active',
  created_at timestamptz default now()
);

create table if not exists public.net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  taken_on date not null default current_date,
  assets numeric(16,2) not null default 0,
  liabilities numeric(16,2) not null default 0,
  created_at timestamptz default now(),
  unique (user_id, taken_on)
);

do $$ declare t text; begin
  foreach t in array array['budget_income','income_sources','net_worth_snapshots'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='own rows') then
      execute format('create policy %I on public.%I for all using (auth.uid()=user_id) with check (auth.uid()=user_id)', 'own rows', t);
    end if;
  end loop;
end $$;

drop table if exists public.mobile_money_transactions;
