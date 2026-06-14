create extension if not exists pgcrypto;

create or replace function public.is_admin_role()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'ADMIN';
$$;

create table if not exists public.author_royalty_ledger (
  order_id text primary key references public.payment_ledger(order_id) on delete cascade,
  author_id text not null,
  user_id uuid null,
  ebook_id text null,
  item_label text null,
  gross_amount_cents integer not null default 0,
  platform_commission_pct numeric(5,2) null,
  platform_commission_cents integer not null default 0,
  author_royalty_pct numeric(5,2) null,
  author_royalty_cents integer not null default 0,
  payment_method text null,
  payment_status text not null default 'PENDING',
  transaction_state text null,
  status text not null default 'PENDING',
  payout_reference text null,
  payout_note text null,
  earned_at timestamptz null,
  processing_at timestamptz null,
  paid_at timestamptz null,
  last_synced_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists author_royalty_ledger_author_id_idx
  on public.author_royalty_ledger (author_id);

create index if not exists author_royalty_ledger_status_idx
  on public.author_royalty_ledger (status);

create index if not exists author_royalty_ledger_earned_at_idx
  on public.author_royalty_ledger (earned_at desc);

create or replace function public.set_author_royalty_ledger_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists author_royalty_ledger_set_updated_at on public.author_royalty_ledger;

create trigger author_royalty_ledger_set_updated_at
before update on public.author_royalty_ledger
for each row
execute function public.set_author_royalty_ledger_updated_at();

alter table public.author_royalty_ledger enable row level security;

drop policy if exists "Authors or admins read author royalty ledger" on public.author_royalty_ledger;
create policy "Authors or admins read author royalty ledger"
on public.author_royalty_ledger
for select
to authenticated
using (
  public.is_admin_role()
  or auth.uid()::text = author_id
);

drop policy if exists "Admins update author royalty ledger" on public.author_royalty_ledger;
create policy "Admins update author royalty ledger"
on public.author_royalty_ledger
for update
to authenticated
using (public.is_admin_role())
with check (public.is_admin_role());
