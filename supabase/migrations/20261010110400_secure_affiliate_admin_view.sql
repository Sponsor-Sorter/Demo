-- Ensure the admin-facing affiliate view honors the caller's table RLS policies.
alter view public.v_affiliate_applications_admin set (security_invoker = true);

