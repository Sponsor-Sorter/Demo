import {supabase} from './supabaseClient.js';
import {categories,sanitizedContent,safeURL} from './blogCore.js?v=20261011-blog1';
export function showBlogEditor(post,onSaved){
 const root=document.getElementById('blog-editor');root.replaceChildren();root.hidden=false;
 const title=document.createElement('h2');title.textContent=post.id?'Edit article':'New article';root.append(title);
 const form=document.createElement('form');root.append(form);
 function field(name,label,type='text',value=''){const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;input.name=name;input.value=value??'';wrap.append(input);form.append(wrap);return input;}
 const name=field('title','Title','text',post.title);name.required=true;name.maxLength=180;
 const slug=field('slug','URL slug (lowercase words separated by hyphens)','text',post.slug);slug.pattern='[a-z0-9]+(-[a-z0-9]+)*';slug.maxLength=160;
 const excerpt=field('excerpt','Short introduction','textarea',post.excerpt);excerpt.maxLength=320;excerpt.style.minHeight='90px';
 const content=field('content','Article HTML (headings, paragraphs, lists, links and tables)','textarea',post.content);content.required=true;
 const categoryLabel=document.createElement('label');categoryLabel.textContent='Category';const category=document.createElement('select');for(const [key,label]of Object.entries(categories)){const o=document.createElement('option');o.value=key;o.textContent=label;category.append(o);}category.value=post.category||'general';categoryLabel.append(category);form.append(categoryLabel);
 const tags=field('tags','Tags, separated by commas; include creators or sponsors for audience filters','text',(post.tags||[]).join(', '));
 const cover=field('cover','Cover URL (local artwork or Supabase image)','text',post.cover_image);
 const author=field('author','Author display name','text',post.author_name||'Sponsor Sorter editorial');
 const published=field('published','Published','checkbox');published.checked=post.published===true;const featured=field('featured','Recommended','checkbox');featured.checked=post.is_featured===true;
 const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Preview article';const preview=document.createElement('div');preview.className='article-body';details.append(summary,preview);details.addEventListener('toggle',()=>{if(details.open)preview.replaceChildren(sanitizedContent(content.value));});form.append(details);
 const actions=document.createElement('div');actions.className='editor-actions';const save=document.createElement('button');save.type='submit';save.textContent='Save article';const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';cancel.onclick=()=>{root.hidden=true;root.replaceChildren();};const feedback=document.createElement('p');feedback.setAttribute('role','status');actions.append(save,cancel);form.append(actions,feedback);
 form.onsubmit=async e=>{e.preventDefault();save.disabled=true;feedback.textContent='Saving…';try{
  if(cover.value.trim()&&!safeURL(cover.value.trim(),true))throw Error('Use a local or Supabase image URL.');
  const clean=document.createElement('div');clean.append(sanitizedContent(content.value));
  const values={title:name.value.trim(),slug:slug.value.trim()||null,excerpt:excerpt.value.trim(),content:clean.innerHTML,category:category.value,tags:tags.value.split(',').map(v=>v.trim().toLowerCase()).filter(Boolean).slice(0,15),cover_image:cover.value.trim()||null,author_name:author.value.trim()||'Sponsor Sorter editorial',published:published.checked,is_featured:featured.checked,updated_at:new Date().toISOString()};
  const query=post.id?supabase.from('blog_posts').update(values).eq('id',post.id):supabase.from('blog_posts').insert(values);const {error}=await query;if(error)throw error;root.hidden=true;root.replaceChildren();await onSaved();
 }catch(error){feedback.textContent=error.message||'Could not save. Your text is still here.';}finally{save.disabled=false;}};
 root.scrollIntoView({behavior:'smooth',block:'start'});name.focus();
}
