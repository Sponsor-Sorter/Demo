-- Legacy blanket authenticated policies must not expose private invoices/proofs.
-- Existing public buckets and the new offer-draft policies are unaffected.
create policy legacy_private_file_guard on storage.objects as restrictive for all to authenticated
using(bucket_id not in ('invoices','sponsorship-proofs') or (
  auth.uid() is not null and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
  and starts_with(name,auth.uid()::text||'/')
))
with check(bucket_id not in ('invoices','sponsorship-proofs') or (
  auth.uid() is not null and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
  and starts_with(name,auth.uid()::text||'/')
));
