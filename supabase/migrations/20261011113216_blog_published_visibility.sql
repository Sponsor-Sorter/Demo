-- Published resources are public; drafts are visible only to administrators.
DROP POLICY IF EXISTS "Allow anyone to select blog posts" ON public.blog_posts;
CREATE POLICY "Published resources or administrator" ON public.blog_posts
FOR SELECT TO anon, authenticated
USING (published IS TRUE OR public.is_current_user_admin());
