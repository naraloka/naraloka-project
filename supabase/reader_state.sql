create extension if not exists pgcrypto;

create table if not exists public.user_library_state (
  user_id uuid not null,
  ebook_id text not null,
  owned boolean not null default false,
  current_page integer not null default 1,
  total_pages integer not null default 1,
  last_read_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, ebook_id)
);

create table if not exists public.user_wishlist (
  user_id uuid not null,
  ebook_id text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, ebook_id)
);

create table if not exists public.user_bookmarks (
  user_id uuid not null,
  ebook_id text not null,
  page integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, ebook_id, page)
);

create table if not exists public.user_highlights (
  id text primary key,
  user_id uuid not null,
  ebook_id text not null,
  page integer not null,
  text text not null,
  note text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_reader_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists user_library_state_set_updated_at on public.user_library_state;
create trigger user_library_state_set_updated_at
before update on public.user_library_state
for each row
execute function public.set_reader_state_updated_at();

drop trigger if exists user_wishlist_set_updated_at on public.user_wishlist;
create trigger user_wishlist_set_updated_at
before update on public.user_wishlist
for each row
execute function public.set_reader_state_updated_at();

drop trigger if exists user_bookmarks_set_updated_at on public.user_bookmarks;
create trigger user_bookmarks_set_updated_at
before update on public.user_bookmarks
for each row
execute function public.set_reader_state_updated_at();

drop trigger if exists user_highlights_set_updated_at on public.user_highlights;
create trigger user_highlights_set_updated_at
before update on public.user_highlights
for each row
execute function public.set_reader_state_updated_at();

alter table public.user_library_state enable row level security;
alter table public.user_wishlist enable row level security;
alter table public.user_bookmarks enable row level security;
alter table public.user_highlights enable row level security;

drop policy if exists "Users manage own library state" on public.user_library_state;
create policy "Users manage own library state"
on public.user_library_state
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own wishlist" on public.user_wishlist;
create policy "Users manage own wishlist"
on public.user_wishlist
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own bookmarks" on public.user_bookmarks;
create policy "Users manage own bookmarks"
on public.user_bookmarks
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own highlights" on public.user_highlights;
create policy "Users manage own highlights"
on public.user_highlights
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
