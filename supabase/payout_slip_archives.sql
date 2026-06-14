create extension if not exists pgcrypto;

create or replace function public.is_admin_role()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'ADMIN';
$$;

create sequence if not exists public.payout_invoice_seq start 1;

create or replace function public.generate_payout_invoice_number()
returns text
language plpgsql
as $$
declare
  seq_value bigint;
begin
  seq_value := nextval('public.payout_invoice_seq');
  return 'NAR-PYT-' || to_char(timezone('utc', now()), 'YYYYMMDD') || '-' || lpad(seq_value::text, 6, '0');
end;
$$;

create table if not exists public.author_payout_slip_archives (
  id text primary key default 'slp_' || replace(gen_random_uuid()::text, '-', ''),
  invoice_number text not null unique default public.generate_payout_invoice_number(),
  author_id uuid not null,
  author_name text not null,
  issuer_name text not null default 'Naraloka',
  issuer_title text null default 'Slip / Invoice Payout Naraloka',
  generated_by_user_id uuid not null,
  generated_by_name text not null,
  filter_start_date date null,
  filter_end_date date null,
  filter_payout_status text null,
  filter_source_type text null,
  entry_count integer not null default 0,
  paid_book_royalty_cents integer not null default 0,
  membership_royalty_cents integer not null default 0,
  total_royalty_cents integer not null default 0,
  available_cents integer not null default 0,
  processing_cents integer not null default 0,
  paid_cents integer not null default 0,
  rows_json jsonb not null default '[]'::jsonb,
  html_content text not null,
  issued_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists author_payout_slip_archives_author_id_idx
  on public.author_payout_slip_archives (author_id, issued_at desc);

create index if not exists author_payout_slip_archives_invoice_number_idx
  on public.author_payout_slip_archives (invoice_number);

create or replace function public.set_author_payout_slip_archives_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists author_payout_slip_archives_set_updated_at on public.author_payout_slip_archives;
create trigger author_payout_slip_archives_set_updated_at
before update on public.author_payout_slip_archives
for each row
execute function public.set_author_payout_slip_archives_updated_at();

alter table public.author_payout_slip_archives enable row level security;

drop policy if exists "Authors or admins read payout slip archives" on public.author_payout_slip_archives;
create policy "Authors or admins read payout slip archives"
on public.author_payout_slip_archives
for select
to authenticated
using (
  public.is_admin_role()
  or auth.uid() = author_id
);

drop policy if exists "Admins create payout slip archives" on public.author_payout_slip_archives;
create policy "Admins create payout slip archives"
on public.author_payout_slip_archives
for insert
to authenticated
with check (public.is_admin_role());

drop policy if exists "Admins update payout slip archives" on public.author_payout_slip_archives;
create policy "Admins update payout slip archives"
on public.author_payout_slip_archives
for update
to authenticated
using (public.is_admin_role())
with check (public.is_admin_role());
