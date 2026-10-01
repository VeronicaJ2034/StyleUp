insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'closet-photos',
  'closet-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Closet photos are publicly readable"
on storage.objects for select
to public
using (bucket_id = 'closet-photos');

create policy "Users can upload their own closet photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'closet-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can update their own closet photos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'closet-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'closet-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete their own closet photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'closet-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
