-- Anonymous readers never invoke the administrator-only helper.
DROP POLICY IF EXISTS "Published resources or administrator" ON public.blog_posts;
CREATE POLICY "Published resources" ON public.blog_posts
FOR SELECT TO anon, authenticated USING (published IS TRUE);
CREATE POLICY "Administrator resource drafts" ON public.blog_posts
FOR SELECT TO authenticated USING (public.is_current_user_admin());
