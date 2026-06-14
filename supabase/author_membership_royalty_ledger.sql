create extension if not exists pgcrypto;

create or replace function public.is_admin_role()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'ADMIN';
$$;

create table if not exists public.author_membership_royalty_ledger (
  entry_id text primary key,
  order_id text not null references public.payment_ledger(order_id) on delete cascade,
  buyer_user_id uuid null,
  author_id text not null,
  membership_plan text not null,
  item_label text null,
  pool_amount_cents integer not null default 0,
  platform_commission_pct numeric(5,2) null,
  platform_commission_cents integer not null default 0,
  distributable_pool_cents integer not null default 0,
  allocation_basis_pages integer not null default 0,
  allocation_ratio numeric(10,6) not null default 0,
  author_royalty_cents integer not null default 0,
  payment_status text not null default 'PENDING',
  status text not null default 'PENDING',
  payout_reference text null,
  payout_note text null,
  source_ebook_ids jsonb not null default '[]'::jsonb,
  earned_at timestamptz null,
  processing_at timestamptz null,
  paid_at timestamptz null,
  last_synced_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists author_membership_royalty_ledger_author_idx
  on public.author_membership_royalty_ledger (author_id);

create index if not exists author_membership_royalty_ledger_order_idx
  on public.author_membership_royalty_ledger (order_id);

create index if not exists author_membership_royalty_ledger_status_idx
  on public.author_membership_royalty_ledger (status);

create or replace function public.set_author_membership_royalty_ledger_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists author_membership_royalty_ledger_set_updated_at on public.author_membership_royalty_ledger;

create trigger author_membership_royalty_ledger_set_updated_at
before update on public.author_membership_royalty_ledger
for each row
execute function public.set_author_membership_royalty_ledger_updated_at();

alter table public.author_membership_royalty_ledger enable row level security;

drop policy if exists "Authors or admins read membership royalty ledger" on public.author_membership_royalty_ledger;
create policy "Authors or admins read membership royalty ledger"
on public.author_membership_royalty_ledger
for select
to authenticated
using (
  public.is_admin_role()
  or auth.uid()::text = author_id
);

drop policy if exists "Admins update membership royalty ledger" on public.author_membership_royalty_ledger;
create policy "Admins update membership royalty ledger"
on public.author_membership_royalty_ledger
for update
to authenticated
using (public.is_admin_role())
with check (public.is_admin_role());
