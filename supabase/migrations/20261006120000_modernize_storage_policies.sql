-- Modernize product-images storage policies:
--   * replaces the deprecated auth.role() = 'authenticated' check with `to authenticated`
--   * keeps the public read policy for the storefront
--   * ensures the bucket is public so getPublicUrl() URLs actually serve
--
-- Run manually via the Supabase SQL editor, then verify with:
--   select policyname, cmd, roles from pg_policies where tablename = 'objects';

drop policy if exists "admin all product-images" on storage.objects;
drop policy if exists "public read product-images" on storage.objects;

create policy "admin all product-images"
on storage.objects for all
to authenticated
using (bucket_id = 'product-images')
with check (bucket_id = 'product-images');

create policy "public read product-images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'product-images');

-- getPublicUrl() builds /object/public/... URLs, which only work on a
-- public bucket. Private buckets return 403 for those URLs even with the
-- policies above.
update storage.buckets set public = true where id = 'product-images';
