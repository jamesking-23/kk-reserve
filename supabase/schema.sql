-- kkingg reserves schema. Run in the Supabase SQL editor.
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique, phone text, avatar_url text,
  theme text default 'dark', accent text default '#FFD700'
);
create table budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  name text not null, starting_balance numeric(14,2) not null check (starting_balance >= 0),
  archived boolean default false, created_at timestamptz default now()
);
create table planned_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  budget_id uuid not null references budgets on delete cascade,
  name text not null, amount numeric(14,2) not null check (amount >= 0)
);
create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  budget_id uuid not null references budgets on delete cascade,
  category_id uuid references planned_categories on delete cascade, -- null = unplanned
  label text, amount numeric(14,2) not null check (amount > 0),
  spent_on date default current_date, created_at timestamptz default now()
);
-- Row Level Security: each user only sees their own rows
do $$ declare t text; begin
  foreach t in array array['budgets','planned_categories','expenses'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "own rows" on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop; end $$;
alter table profiles enable row level security;
create policy "own profile" on profiles for all using (id = auth.uid()) with check (id = auth.uid());
create function handle_new_user() returns trigger language plpgsql security definer as $$
begin insert into profiles (id, username, phone) values (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'phone'); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
insert into storage.buckets (id, name, public) values ('avatars','avatars',true) on conflict do nothing;
create policy "avatar upload own" on storage.objects for insert to authenticated
  with check (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar read" on storage.objects for select using (bucket_id='avatars');
