insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-profile-media',
  'user-profile-media',
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

drop policy if exists "Users manage own profile media" on storage.objects;
create policy "Users manage own profile media"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'user-profile-media'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'user-profile-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);
