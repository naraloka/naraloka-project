create extension if not exists pgcrypto;

create table if not exists public.payment_ledger (
  order_id text primary key,
  user_id uuid null,
  item_type text null,
  item_id text null,
  item_label text null,
  amount_cents integer null,
  payment_method text null,
  status text not null default 'PENDING',
  buyer_email text null,
  buyer_whatsapp text null,
  membership_plan text null,
  ebook_id text null,
  author_id text null,
  platform_commission_pct numeric(5,2) null,
  platform_commission_cents integer null,
  author_royalty_pct numeric(5,2) null,
  author_royalty_cents integer null,
  redirect_url text null,
  finish_url text null,
  transaction_status text null,
  transaction_state text null,
  should_grant_access boolean not null default false,
  fraud_status text null,
  payment_type text null,
  midtrans_status_code text null,
  metadata jsonb not null default '{}'::jsonb,
  webhook_payload jsonb null,
  midtrans_response jsonb null,
  webhook_received_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists payment_ledger_user_id_idx
  on public.payment_ledger (user_id);

create index if not exists payment_ledger_status_idx
  on public.payment_ledger (status);

create index if not exists payment_ledger_transaction_state_idx
  on public.payment_ledger (transaction_state);

create or replace function public.set_payment_ledger_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists payment_ledger_set_updated_at on public.payment_ledger;

create trigger payment_ledger_set_updated_at
before update on public.payment_ledger
for each row
execute function public.set_payment_ledger_updated_at();

alter table public.payment_ledger enable row level security;

drop policy if exists "Users can read own payment ledger" on public.payment_ledger;

create policy "Users can read own payment ledger"
on public.payment_ledger
for select
to authenticated
using (auth.uid() = user_id);
