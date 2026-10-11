export const categories = {guides:'Practical guides',tips:'Better partnerships',analytics:'Measurement',platform:'Using Sponsor Sorter',case_study:'Worked examples',general:'Creator business'};
export function textOnly(value) { return String(value ?? '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(); }
export function readingMinutes(content) { return Math.max(1, Math.ceil(textOnly(content).split(/\s+/).filter(Boolean).length / 210)); }
export function safeURL(value, image=false) {
  if(typeof value!=='string'||!value.trim())return null;
  try { const url=new URL(String(value),location.origin); if(url.protocol!=='https:' && !(url.protocol==='http:' && url.origin===location.origin))return null; if(image && url.origin!==location.origin && !url.hostname.endsWith('.supabase.co'))return null; return url.href; } catch {return null;}
}
export function articleURL(post) {return './blog-article.html?'+(post.slug?'slug='+encodeURIComponent(post.slug):'id='+encodeURIComponent(post.id));}
// Rebuild a small content vocabulary. No author-supplied events, styles, embeds,
// arbitrary classes, SVG, scripts or executable URLs reach the live document.
export function sanitizedContent(raw) {
 const parsed=new DOMParser().parseFromString(String(raw??''),'text/html');
 const output=document.createDocumentFragment();
 const allowed=new Set(['P','H2','H3','H4','UL','OL','LI','STRONG','EM','B','I','A','BLOCKQUOTE','PRE','CODE','BR','HR','TABLE','THEAD','TBODY','TR','TH','TD','FIGURE','FIGCAPTION','IMG']);
 const blocked=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','FORM','INPUT','BUTTON','LINK','META','TEMPLATE']);
 function visit(node,parent){
  if(node.nodeType===3){parent.append(document.createTextNode(node.textContent));return;}
  if(node.nodeType!==1||blocked.has(node.tagName))return;
  if(!allowed.has(node.tagName)){for(const child of node.childNodes)visit(child,parent);return;}
  const el=document.createElement(node.tagName.toLowerCase());
  if(node.tagName==='A'){const href=safeURL(node.getAttribute('href'));if(href){el.href=href;el.rel='noopener noreferrer';}}
  if(node.tagName==='IMG'){const src=safeURL(node.getAttribute('src'),true);if(!src)return;el.src=src;el.alt=node.getAttribute('alt')||'';el.loading='lazy';el.decoding='async';}
  if(node.tagName==='TH')el.scope='col';
  for(const child of node.childNodes)visit(child,el);parent.append(el);
 }
 for(const child of parsed.body.childNodes)visit(child,output);return output;
}
