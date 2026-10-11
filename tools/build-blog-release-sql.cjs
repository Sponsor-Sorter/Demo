// Emit an atomic, repeatable editorial rollout from the reviewed release JSON.
const fs = require('node:fs');
const records = fs.readFileSync(require('node:path').join(__dirname, '../content/blog-release.json'), 'utf8');
if (records.includes('$blog$')) throw new Error('Reserved SQL delimiter in content');
process.stdout.write(`begin;
lock table public.blog_posts in share row exclusive mode;
create temporary table editorial_release on commit drop as select * from jsonb_to_recordset($blog$${records}$blog$::jsonb) as p(legacy uuid,slug text,title text,category text,tags text[],excerpt text,content text,cover_image text,author_name text,published boolean,is_featured boolean);
do $$begin if (select count(*) from public.blog_posts p join editorial_release e on p.id=e.legacy) <> 10 then raise exception 'Expected ten existing editorial posts; review before publishing'; end if; end$$;
update public.blog_posts p set slug=e.slug,title=e.title,category=e.category,tags=e.tags,excerpt=e.excerpt,content=e.content,cover_image=e.cover_image,author_name=e.author_name,published=e.published,is_featured=e.is_featured,updated_at=now() from editorial_release e where p.id=e.legacy;
insert into public.blog_posts(slug,title,category,tags,excerpt,content,cover_image,author_name,published,is_featured)
select slug,title,category,tags,excerpt,content,cover_image,author_name,published,is_featured from editorial_release e where legacy is null and not exists(select 1 from public.blog_posts p where p.slug=e.slug);
commit;
select count(*) as published_posts from public.blog_posts where published is true;`);
