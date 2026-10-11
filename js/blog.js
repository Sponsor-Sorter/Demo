import { supabase } from './supabaseClient.js';
import { categories, readingMinutes, safeURL, articleURL, sanitizedContent, textOnly } from './blogCore.js?v=20261011-blog1';
const fields='id,title,content,excerpt,tags,category,published,created_at,updated_at,cover_image,author_name,slug,is_featured';
let posts=[],admin=false,page=1;
const root=document.getElementById('blog-list')||document.getElementById('blog-article-container');
const status=document.getElementById('blog-status');
function node(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
function date(value){const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}):'';}
function cover(post){return safeURL(post.cover_image,true)||new URL('../assets/blog/brief.svg',import.meta.url).href;}
function meta(post){const el=node('div',undefined,'resource-meta');el.append(node('span',categories[post.category]||'Creator business','topic'),node('span',readingMinutes(post.content)+' min read'));if(!post.published)el.append(node('span','Draft · admin only'));return el;}
function card(post){
 const el=node('article',undefined,'resource-card');const imageLink=node('a',undefined,'cover-link');imageLink.href=articleURL(post);imageLink.tabIndex=-1;imageLink.setAttribute('aria-hidden','true');
 const img=node('img');img.src=cover(post);img.alt='';img.loading='lazy';img.width=960;img.height=540;imageLink.append(img);
 const body=node('div',undefined,'resource-card-body');const h=node('h2'),link=node('a',post.title);link.href=articleURL(post);h.append(link);
 const read=node('a','Read guide →','read-link');read.href=articleURL(post);read.setAttribute('aria-label','Read '+post.title);
 body.append(meta(post),h,node('p',post.excerpt||textOnly(post.content).slice(0,180)),read);
 if(admin){const edit=node('button','Edit article');edit.type='button';edit.onclick=()=>openEditor(post);body.append(edit);}
 el.append(imageLink,body);return el;
}
async function load(){
 status.textContent='Loading resources…';
 try{
  let q=supabase.from('blog_posts').select(fields).order('created_at',{ascending:false}).limit(1000);
  if(!admin)q=q.eq('published',true);
  const {data,error}=await q;if(error)throw error;posts=data||[];
  if(document.getElementById('blog-list'))renderList();else renderArticle();
 }catch{root.replaceChildren(node('p','We could not load the resources. Please try again.','blog-empty'));status.textContent='Resources unavailable.';const retry=node('button','Try again');retry.onclick=load;root.append(retry);}
}
function renderList(){
 const term=document.getElementById('blog-search').value.trim().toLowerCase();const category=document.getElementById('blog-category').value;const audience=document.getElementById('blog-audience').value;
 let matches=posts.filter(p=>(!category||p.category===category)&&(!term||[p.title,p.excerpt,textOnly(p.content),...(p.tags||[])].join(' ').toLowerCase().includes(term))&&(!audience||(p.tags||[]).includes(audience)));
 const sort=document.getElementById('blog-sort').value;
 matches.sort((a,b)=>sort==='shortest'?readingMinutes(a.content)-readingMinutes(b.content):sort==='title'?a.title.localeCompare(b.title):sort==='recommended'?Number(b.is_featured)-Number(a.is_featured)||new Date(b.updated_at)-new Date(a.updated_at):new Date(b.created_at)-new Date(a.created_at));
 const totalPages=Math.max(1,Math.ceil(matches.length/9));page=Math.min(page,totalPages);
 root.replaceChildren(...matches.slice((page-1)*9,page*9).map(card));
 if(!matches.length){const empty=node('div',undefined,'blog-empty');empty.append(node('h2','No guides match that search'),node('p','Try a broader phrase or clear the filters.'));root.append(empty);}
 status.textContent=matches.length+' '+(matches.length===1?'resource':'resources')+' · '+(admin?'Includes unpublished drafts.':'Practical reading for creators and sponsors.');
 document.getElementById('blog-page-label').textContent='Page '+page+' of '+totalPages;
 document.getElementById('blog-prev').disabled=page===1;document.getElementById('blog-next').disabled=page===totalPages;
}
function renderArticle(){
 const params=new URLSearchParams(location.search);const slug=params.get('slug'),id=params.get('id');
 const post=posts.find(p=>slug?p.slug===slug:p.id===id);
 if(!post){root.replaceChildren(node('h1','Article not found'),node('p','This article may have moved or is not published. Browse the resource centre for more guides.'));status.textContent='';return;}
 document.title=post.title+' | Sponsor Sorter';document.querySelector('meta[name="description"]').content=post.excerpt||textOnly(post.content).slice(0,160);
 const canonical=document.querySelector('link[rel="canonical"]');canonical.href=new URL(articleURL(post),'https://sponsorsorter.com/').href;
 root.replaceChildren();status.textContent='';
 const top=node('header',undefined,'article-top');top.append(meta(post),node('h1',post.title),node('p',post.excerpt,'article-deck'));
 const byline=node('div',undefined,'resource-meta');byline.append(node('span',post.author_name||'Sponsor Sorter editorial'),node('span','Published '+date(post.created_at)));if(post.updated_at)byline.append(node('span','Reviewed '+date(post.updated_at)));top.append(byline);
 const image=node('img');image.className='article-cover';image.src=cover(post);image.alt='Editorial illustration for '+post.title;image.width=960;image.height=540;top.append(image,node('p','Original Sponsor Sorter illustration · illustrative, not campaign data','art-caption'));
 const tools=node('div',undefined,'article-tools');const copy=node('button','Copy article link');copy.onclick=async()=>{try{await navigator.clipboard.writeText(canonical.href);copy.textContent='Link copied';}catch{copy.textContent='Copy this address from your browser';}};const print=node('button','Print / save PDF');print.onclick=()=>window.print();tools.append(copy,print);
 if(navigator.share){const share=node('button','Share');share.onclick=()=>navigator.share({title:post.title,url:canonical.href}).catch(()=>{});tools.append(share);}
 if(admin){const edit=node('button','Edit article');edit.onclick=()=>openEditor(post);tools.append(edit);}top.append(tools);
 const layout=node('div',undefined,'article-layout'),toc=node('nav',undefined,'article-toc');toc.setAttribute('aria-label','On this page');toc.append(node('h2','In this guide'));
 const body=node('div',undefined,'article-body');body.append(sanitizedContent(post.content));
 body.querySelectorAll('h2,h3').forEach((h,i)=>{h.id='section-'+i;const link=node('a',h.textContent);link.href='#'+h.id;toc.append(link);});
 for(const table of body.querySelectorAll('table')){const wrap=node('div',undefined,'table-scroll');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Scrollable reference table');table.before(wrap);wrap.append(table);}
 layout.append(toc,body);root.append(top,layout);
 const related=posts.filter(p=>p.id!==post.id&&p.published).sort((a,b)=>Number(b.category===post.category)-Number(a.category===post.category)).slice(0,3);
 const section=node('section',undefined,'related-section');section.append(node('h2','Keep reading'));const grid=node('div',undefined,'resource-grid');grid.append(...related.map(card));section.append(grid);root.append(section);
 const progress=document.getElementById('reading-progress');function updateProgress(){const box=body.getBoundingClientRect();const distance=box.height-innerHeight;progress.style.width=Math.round(distance>0?Math.max(0,Math.min(1,-box.top/distance))*100:100)+'%';}addEventListener('scroll',updateProgress,{passive:true});updateProgress();
}
async function openEditor(post={}){
 if(!admin)return;const {showBlogEditor}=await import('./blogEditor.js?v=20261011-blog1');showBlogEditor(post,()=>load());
}
async function init(){
 try{const {data}=await supabase.auth.getSession();const user=data?.session?.user;
  if(user){const {data:profile}=await supabase.from('users_extended_data').select('is_admin,userType').eq('user_id',user.id).maybeSingle();admin=profile?.is_admin===true;
   const auth=document.getElementById('auth-link');if(auth){const link=auth.querySelector('a');link.textContent='Dashboard';link.href=profile?.userType==='sponsor'?'./dashboardsponsor.html':'./dashboardsponsee.html';}
   const login=document.getElementById('login-logout-link');if(login){login.textContent='Account';login.href='./settings.html';}
  }
 }catch{/* Public resources remain available if session lookup fails. */}
 const add=document.getElementById('blog-add-btn');if(add){add.hidden=!admin;add.onclick=()=>openEditor();}
 for(const id of ['blog-search','blog-category','blog-audience','blog-sort'])document.getElementById(id)?.addEventListener(id==='blog-search'?'input':'change',()=>{page=1;renderList();});
 document.getElementById('blog-clear')?.addEventListener('click',()=>{for(const id of ['blog-search','blog-category','blog-audience'])document.getElementById(id).value='';page=1;renderList();});
 document.getElementById('blog-prev')?.addEventListener('click',()=>{page--;renderList();root.scrollIntoView({block:'start'});});document.getElementById('blog-next')?.addEventListener('click',()=>{page++;renderList();root.scrollIntoView({block:'start'});});
 await load();
}
init();
