const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const pages=['forum','groupoffer','newoffer','publicOffers','review','reviews','reviewThread','featured','settings','supporters','stats','viewprofile','viewprofiles','contact','reset-password','roadmap','payment-failed','payment-success','payment-success-group','payment-success-public','payment-success-signup','oauth2callback'];
test('secondary pages have a consistent introduction and bounded responsive stylesheet',()=>{
 for(const name of pages){const source=fs.readFileSync(path.join(root,name+'.html'),'utf8');assert.ok(source.includes('content-pages.css?v=20261012-pages1'),name);assert.match(source,/<h1>[^<]+<\/h1>/,name);assert.ok(source.includes('class="page-intro"'),name);assert.ok(source.includes('page-skip-link'),name);assert.ok(source.includes('class="site-footer"'),name);assert.equal((source.match(/<h1\b/g)||[]).length,1,name);}
});
test('legacy sample dashboards and terms send visitors to maintained pages',()=>{
 for(const [name,target] of [['dashboard.html','guest.html?role=sponsor'],['dashboard-jane.html','guest.html?role=sponsee'],['tos.html','terms.html'],['public/index.html','index.html']]){const source=fs.readFileSync(path.join(root,name),'utf8');assert.ok(source.includes(target),name);assert.ok(source.includes('location.replace(destination.href)'),name);assert.ok(source.includes('destination.hash=location.hash'),name);assert.ok(source.includes('new URLSearchParams(location.search)'),name);}
});
test('payment failure copy does not fabricate an uncharged or refunded result',()=>{
 const source=fs.readFileSync(path.join(root,'payment-failed.html'),'utf8');assert.ok(!source.includes('No money was charged'));assert.ok(source.includes('Check your receipt'));
});
test('responsive content rules use bounded grids and do not hide document overflow',()=>{
 const css=fs.readFileSync(path.join(root,'content-pages.css'),'utf8');assert.ok(css.includes('minmax(0, 1fr)'));assert.ok(css.includes('max-width: 540px'));assert.ok(css.includes('--page-width: 1200px'));assert.ok(!css.includes('overflow-x: hidden'));
});
test('primary pages expose exactly one skip-to-content link',()=>{
 for(const name of ['index','help','guest']){
  const source=fs.readFileSync(path.join(root,name+'.html'),'utf8');
  assert.equal((source.match(/>\s*Skip to content\s*</gi)||[]).length,1,name);
  assert.match(source,/<a class="page-skip-link" href="#main">Skip to content<\/a>/i,name);
  const main=source.match(/<main\b[^>]*\bid="main"[^>]*>/i)?.[0];
  assert.ok(main,name);
  assert.match(main,/\btabindex="-1"/i,name);
 }
});
