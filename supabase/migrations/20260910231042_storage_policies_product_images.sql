-- Allow authenticated users to upload/manage files in product-images bucket
create policy "admin all product-images"
on storage.objects for all
using (bucket_id = 'product-images' and auth.role() = 'authenticated')
with check (bucket_id = 'product-images' and auth.role() = 'authenticated');

-- Allow public read access to product images (since it's a public storefront)
create policy "public read product-images"
on storage.objects for select
using (bucket_id = 'product-images');
