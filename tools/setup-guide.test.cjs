const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const catalog=JSON.parse(fs.readFileSync('app-assets/setup-guide.json','utf8'));
class Element {
 constructor(tag){this.tag=tag;this.children=[];}
 append(...items){this.children.push(...items);} replaceChildren(...items){this.children=items;}
 setAttribute(k,v){this[k]=v;} remove(){this.removed=true;} focus(){}
 querySelector(tag){return this.children.find(n=>n.tag===tag);}
 all(){return this.children.flatMap(n=>[n,...(n.all?.()||[])]);}
}
async function fixture({role='besponsored',onboarded=false,saved='0',result={data:{user_id:'fixture'},error:null}}={}){
 let panel,writes=0,updating=false;const values=new Map([['ss_setup_step:fixture',saved]]);
 const profile={select(){return this;},eq(){return this;},update(){updating=true;writes++;return this;},single:async()=>updating?result:{data:{userType:role,onboarded},error:null}};
 const context={supabase:{auth:{getUser:async()=>({data:{user:{id:'fixture'}}})},from:()=>profile},URL,fetch:async()=>({ok:true,json:async()=>catalog}),
 document:{getElementById:()=>null,querySelector:()=>({after:p=>panel=p}),createElement:tag=>new Element(tag)},
 localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}};
 const source=fs.readFileSync('js/setupGuide.js','utf8').replace(/^import .*;\r?\n/,'').replace('export async function','async function').replace('import.meta.url',"'https://example.invalid/js/setupGuide.js'");
 vm.createContext(context);vm.runInContext(source,context);await context.startSetupGuide();
 return {panel,values,writes:()=>writes,button:text=>panel.all().find(n=>n.tag==='button'&&n.textContent===text)};
}
test('creator and sponsor guides start with the correct role and save progress',async()=>{
 for(const [role,title] of [['besponsored','Make your profile useful'],['sponsor','Introduce your brand']]){
  const f=await fixture({role});assert.equal(f.panel.querySelector('h2').textContent,title);
  await f.button('Next').onclick();assert.equal(f.values.get('ss_setup_step:fixture'),'1');
 }
});
test('invalid saved step starts safely; returning account resumes its own step',async()=>{
 for(const saved of ['Infinity','1.5','-1','broken'])assert.match((await fixture({saved})).panel.querySelector('p').textContent,/1 of 4/);
 assert.match((await fixture({saved:'2'})).panel.querySelector('p').textContent,/3 of 4/);
 assert.equal((await fixture({onboarded:true})).panel,undefined);
});
test('continue later does not mark onboarding finished',async()=>{
 const f=await fixture();f.button('Continue later').onclick();assert.equal(f.panel.removed,true);assert.equal(f.writes(),0);
});
test('zero-row save failure remains retryable; confirmed completion clears progress',async()=>{
 for(const [result,success] of [[{data:null,error:null},false],[{data:{user_id:'fixture'},error:null},true]]){
  const f=await fixture({saved:'3',result});await f.button('Finish guide').onclick();
  if(success){assert.match(f.panel.querySelector('p').textContent,/ready to explore/);assert.equal(f.values.has('ss_setup_step:fixture'),false);}
  else {assert.ok(f.button('Finish guide'));assert.equal(f.button('Finish guide').disabled,false);assert.match(f.panel.all().find(n=>n.role==='status').textContent,/Could not save/);}
 }
});
test('website and app use the same four-step role guides with safe destinations',()=>{
 const nativeCatalog='../SponsorSorterApp/assets/data/setup-guide.json';
 if(fs.existsSync(nativeCatalog))assert.deepEqual(catalog,JSON.parse(fs.readFileSync(nativeCatalog,'utf8')));
 for(const steps of Object.values(catalog)){assert.equal(steps.length,4);for(const s of steps){assert.match(s.web,/^\.\//);assert.match(s.app,/^\/\(tabs\)\/|^https:\/\/sponsorsorter\.com\//);assert.ok(s.body.length>80);}}
});
