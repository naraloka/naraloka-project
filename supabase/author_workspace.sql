create extension if not exists pgcrypto;

create or replace function public.is_admin_role()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'ADMIN';
$$;

create table if not exists public.author_workspace_profiles (
  user_id uuid primary key,
  display_name text not null,
  avatar_url text null,
  bio text null,
  phone text null,
  portfolio_url text null,
  payout_account text null,
  payout_method text null,
  bank_name text null,
  bank_account_name text null,
  bank_account_number text null,
  bank_branch text null,
  ewallet_provider text null,
  ewallet_account_name text null,
  ewallet_account_number text null,
  payout_notes text null,
  specialty text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.author_collaboration_requests (
  id text primary key,
  author_id uuid not null,
  full_name text not null,
  email text not null,
  phone text null,
  portfolio_url text null,
  pitch text not null,
  status text not null default 'SENT',
  sent_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.author_manuscripts (
  id text primary key,
  author_id uuid not null,
  author_display_name text null,
  title text not null,
  category text not null,
  file_name text not null,
  storage_bucket text null,
  storage_path text null,
  storage_mime_type text null,
  storage_size_bytes integer null,
  storage_uploaded_at timestamptz null,
  cover_storage_bucket text null,
  cover_storage_path text null,
  cover_storage_mime_type text null,
  cover_storage_size_bytes integer null,
  cover_storage_uploaded_at timestamptz null,
  cover_public_url text null,
  submitted_at timestamptz not null default timezone('utc', now()),
  status text not null default 'DRAFT',
  admin_note text null,
  synopsis text null,
  target_audience text null,
  tags jsonb not null default '[]'::jsonb,
  word_count integer null,
  price_cents integer null,
  suggested_monetization text null,
  monetization_note text null,
  published_ebook_id text null,
  published_at timestamptz null,
  published_access text null,
  published_required_plan text null,
  published_price_cents integer null,
  published_is_featured boolean not null default false,
  published_is_best_seller boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.author_manuscript_reviews (
  id text primary key,
  manuscript_id text not null references public.author_manuscripts(id) on delete cascade,
  reviewer_id uuid not null,
  reviewer_name text not null,
  decision text not null default 'COMMENT',
  note text not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.author_manuscripts
  add column if not exists storage_bucket text null,
  add column if not exists storage_path text null,
  add column if not exists storage_mime_type text null,
  add column if not exists storage_size_bytes integer null,
  add column if not exists storage_uploaded_at timestamptz null,
  add column if not exists cover_storage_bucket text null,
  add column if not exists cover_storage_path text null,
  add column if not exists cover_storage_mime_type text null,
  add column if not exists cover_storage_size_bytes integer null,
  add column if not exists cover_storage_uploaded_at timestamptz null,
  add column if not exists cover_public_url text null;

alter table public.author_workspace_profiles
  add column if not exists avatar_url text null,
  add column if not exists payout_method text null,
  add column if not exists bank_name text null,
  add column if not exists bank_account_name text null,
  add column if not exists bank_account_number text null,
  add column if not exists bank_branch text null,
  add column if not exists ewallet_provider text null,
  add column if not exists ewallet_account_name text null,
  add column if not exists ewallet_account_number text null,
  add column if not exists payout_notes text null;

create index if not exists author_collaboration_requests_author_id_idx
  on public.author_collaboration_requests (author_id);

create index if not exists author_manuscripts_author_id_idx
  on public.author_manuscripts (author_id);

create index if not exists author_manuscripts_published_at_idx
  on public.author_manuscripts (published_at);

create index if not exists author_manuscripts_storage_path_idx
  on public.author_manuscripts (storage_path);

create index if not exists author_manuscript_reviews_manuscript_id_idx
  on public.author_manuscript_reviews (manuscript_id, created_at desc);

create or replace function public.set_author_workspace_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists author_workspace_profiles_set_updated_at on public.author_workspace_profiles;
create trigger author_workspace_profiles_set_updated_at
before update on public.author_workspace_profiles
for each row
execute function public.set_author_workspace_updated_at();

drop trigger if exists author_collaboration_requests_set_updated_at on public.author_collaboration_requests;
create trigger author_collaboration_requests_set_updated_at
before update on public.author_collaboration_requests
for each row
execute function public.set_author_workspace_updated_at();

drop trigger if exists author_manuscripts_set_updated_at on public.author_manuscripts;
create trigger author_manuscripts_set_updated_at
before update on public.author_manuscripts
for each row
execute function public.set_author_workspace_updated_at();

alter table public.author_workspace_profiles enable row level security;
alter table public.author_collaboration_requests enable row level security;
alter table public.author_manuscripts enable row level security;
alter table public.author_manuscript_reviews enable row level security;

drop policy if exists "Authors or admins read profiles" on public.author_workspace_profiles;
create policy "Authors or admins read profiles"
on public.author_workspace_profiles
for select
to authenticated
using (auth.uid() = user_id or public.is_admin_role());

drop policy if exists "Authors or admins manage profiles" on public.author_workspace_profiles;
create policy "Authors or admins manage profiles"
on public.author_workspace_profiles
for all
to authenticated
using (auth.uid() = user_id or public.is_admin_role())
with check (auth.uid() = user_id or public.is_admin_role());

drop policy if exists "Authors or admins read collaborations" on public.author_collaboration_requests;
create policy "Authors or admins read collaborations"
on public.author_collaboration_requests
for select
to authenticated
using (auth.uid() = author_id or public.is_admin_role());

drop policy if exists "Authors create own collaborations" on public.author_collaboration_requests;
create policy "Authors create own collaborations"
on public.author_collaboration_requests
for insert
to authenticated
with check (auth.uid() = author_id or public.is_admin_role());

drop policy if exists "Authors or admins update collaborations" on public.author_collaboration_requests;
create policy "Authors or admins update collaborations"
on public.author_collaboration_requests
for update
to authenticated
using (auth.uid() = author_id or public.is_admin_role())
with check (auth.uid() = author_id or public.is_admin_role());

drop policy if exists "Workspace read manuscripts" on public.author_manuscripts;
create policy "Workspace read manuscripts"
on public.author_manuscripts
for select
to authenticated
using (
  public.is_admin_role()
  or auth.uid() = author_id
  or published_at is not null
);

drop policy if exists "Authors create own manuscripts" on public.author_manuscripts;
create policy "Authors create own manuscripts"
on public.author_manuscripts
for insert
to authenticated
with check (auth.uid() = author_id or public.is_admin_role());

drop policy if exists "Authors or admins update manuscripts" on public.author_manuscripts;
create policy "Authors or admins update manuscripts"
on public.author_manuscripts
for update
to authenticated
using (auth.uid() = author_id or public.is_admin_role())
with check (auth.uid() = author_id or public.is_admin_role());

drop policy if exists "Authors or admins delete manuscripts" on public.author_manuscripts;
create policy "Authors or admins delete manuscripts"
on public.author_manuscripts
for delete
to authenticated
using (auth.uid() = author_id or public.is_admin_role());

drop policy if exists "Authors or admins read manuscript reviews" on public.author_manuscript_reviews;
create policy "Authors or admins read manuscript reviews"
on public.author_manuscript_reviews
for select
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1
    from public.author_manuscripts manuscript
    where manuscript.id = manuscript_id
      and manuscript.author_id = auth.uid()
  )
);

drop policy if exists "Admins create manuscript reviews" on public.author_manuscript_reviews;
create policy "Admins create manuscript reviews"
on public.author_manuscript_reviews
for insert
to authenticated
with check (public.is_admin_role());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'author-manuscripts',
  'author-manuscripts',
  false,
  20971520,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'author-manuscript-covers',
  'author-manuscript-covers',
  true,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'author-profile-media',
  'author-profile-media',
  true,
  2097152,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authors manage own manuscript files" on storage.objects;
create policy "Authors manage own manuscript files"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'author-manuscripts'
  and (
    public.is_admin_role()
    or auth.uid()::text = (storage.foldername(name))[1]
  )
)
with check (
  bucket_id = 'author-manuscripts'
  and (
    public.is_admin_role()
    or auth.uid()::text = (storage.foldername(name))[1]
  )
);

drop policy if exists "Authors manage own manuscript covers" on storage.objects;
create policy "Authors manage own manuscript covers"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'author-manuscript-covers'
  and (
    public.is_admin_role()
    or auth.uid()::text = (storage.foldername(name))[1]
  )
)
with check (
  bucket_id = 'author-manuscript-covers'
  and (
    public.is_admin_role()
    or auth.uid()::text = (storage.foldername(name))[1]
  )
);

drop policy if exists "Authors manage own profile media" on storage.objects;
create policy "Authors manage own profile media"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'author-profile-media'
  and (
    public.is_admin_role()
    or auth.uid()::text = (storage.foldername(name))[1]
  )
)
with check (
  bucket_id = 'author-profile-media'
  and (
    public.is_admin_role()
    or auth.uid()::text = (storage.foldername(name))[1]
  )
);
