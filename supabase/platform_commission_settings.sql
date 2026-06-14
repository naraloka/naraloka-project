create table if not exists public.platform_commission_settings (
  settings_key text primary key,
  free_access_pct integer not null default 0,
  paid_book_pct integer not null default 20,
  membership_premium_pct integer not null default 30,
  membership_edu_pct integer not null default 25,
  updated_by_user_id uuid null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint platform_commission_settings_free_access_pct_check
    check (free_access_pct between 0 and 60),
  constraint platform_commission_settings_paid_book_pct_check
    check (paid_book_pct between 0 and 60),
  constraint platform_commission_settings_membership_premium_pct_check
    check (membership_premium_pct between 0 and 60),
  constraint platform_commission_settings_membership_edu_pct_check
    check (membership_edu_pct between 0 and 60)
);

insert into public.platform_commission_settings (
  settings_key,
  free_access_pct,
  paid_book_pct,
  membership_premium_pct,
  membership_edu_pct
)
values ('default', 0, 20, 30, 25)
on conflict (settings_key) do nothing;

alter table public.platform_commission_settings enable row level security;

drop policy if exists "Public read platform commission settings" on public.platform_commission_settings;
create policy "Public read platform commission settings"
on public.platform_commission_settings
for select
using (true);

drop policy if exists "Admins manage platform commission settings" on public.platform_commission_settings;
create policy "Admins manage platform commission settings"
on public.platform_commission_settings
for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN');
