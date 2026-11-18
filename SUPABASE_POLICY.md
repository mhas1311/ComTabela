# Políticas de Segurança e Esquema do Banco (Supabase)

Execute o script abaixo no **SQL Editor** do seu painel no Supabase para configurar tabelas, restrições de integridade, índices e políticas de **Row Level Security (RLS)** do **ComTabela**.

> O script utiliza `IF NOT EXISTS` para ser seguro tanto em projetos novos quanto em bancos já existentes.

```sql
-- =========================================================
-- 1. TABELA DE CATEGORIAS
-- =========================================================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  type text not null check (type in ('income', 'expense')),
  color text not null default '#10b981',
  created_at timestamptz not null default now()
);

create unique index if not exists categories_user_name_type_idx
  on public.categories (user_id, lower(trim(name)), type);

alter table public.categories enable row level security;

drop policy if exists "categories_select_own" on public.categories;
create policy "categories_select_own"
  on public.categories for select
  using (auth.uid() = user_id);

drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own"
  on public.categories for insert
  with check (auth.uid() = user_id);

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own"
  on public.categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own"
  on public.categories for delete
  using (auth.uid() = user_id);

-- =========================================================
-- 2. TABELA DE TRANSAÇÕES
-- =========================================================
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  description text not null check (char_length(trim(description)) > 0),
  amount numeric(14, 2) not null check (amount >= 0),
  type text not null check (type in ('income', 'expense')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'received')),
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc);

alter table public.transactions enable row level security;

drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own"
  on public.transactions for select
  using (auth.uid() = user_id);

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own"
  on public.transactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own"
  on public.transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own"
  on public.transactions for delete
  using (auth.uid() = user_id);

-- =========================================================
-- 3. CONFIGURAÇÕES E DADOS OPERACIONAIS POR USUÁRIO (OPCIONAL)
-- Caso não exista, o aplicativo sincroniza automaticamente via
-- user_metadata autenticado do Supabase Auth + cache isolado por user_id.
-- =========================================================
create table if not exists public.user_workspace (
  user_id uuid primary key references auth.users(id) on delete cascade,
  budget numeric(14, 2) default 0,
  operations_enabled boolean not null default false,
  bankroll_initial numeric(14, 2) default 0,
  accounts jsonb not null default '[]'::jsonb,
  category_budgets jsonb not null default '{}'::jsonb,
  tx_accounts jsonb not null default '{}'::jsonb,
  ev_entries jsonb not null default '[]'::jsonb,
  inventory_items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_workspace enable row level security;

drop policy if exists "workspace_select_own" on public.user_workspace;
create policy "workspace_select_own"
  on public.user_workspace for select
  using (auth.uid() = user_id);

drop policy if exists "workspace_insert_own" on public.user_workspace;
create policy "workspace_insert_own"
  on public.user_workspace for insert
  with check (auth.uid() = user_id);

drop policy if exists "workspace_update_own" on public.user_workspace;
create policy "workspace_update_own"
  on public.user_workspace for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "workspace_delete_own" on public.user_workspace;
create policy "workspace_delete_own"
  on public.user_workspace for delete
  using (auth.uid() = user_id);
```
