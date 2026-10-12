const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.value='';this.checked=false;}
 append(...nodes){this.children.push(...nodes);} replaceChildren(...nodes){this.children=nodes;}
 setAttribute(key,value){this[key]=value;} addEventListener(name,fn){this.listeners[name]=fn;}
 reset(){} reportValidity(){return true;} scrollIntoView(){} focus(){}
 all(){return this.children.filter(n=>n instanceof Element).flatMap(n=>[n,...n.all()]);}
 querySelectorAll(selector){return this.all().filter(n=>n.tag==='input'&&(selector!=='input:checked'||n.checked));}
}
async function fixture(result={data:{id:'saved'},error:null}) {
 const host=new Element('main');let writes=0;
 const profile={select(){return this;},eq(){return this;},single:async()=>({data:{userType:'besponsored',username:'fixture'}})};
 const supabase={auth:{getSession:async()=>({data:{session:{user:{id:'fixture-user'}}}})},from(table){
  if(table==='users_extended_data')return profile;
  return {select(){return this;},eq(){return this;},order(){return this;},limit:async()=>({data:[],error:null}),
   insert(){writes++;return this;},update(){writes++;return this;},single:async()=>{if(result instanceof Error)throw result;return result;}};
 }};
 const document={getElementById:()=>host,createElement:tag=>new Element(tag),createTextNode:text=>text};
 const source=fs.readFileSync('js/creatorPackageEditor.js','utf8').replace(/import[\s\S]*?from\s*["'][^"']+["'];/g,'')
  .replace('mount().catch(', 'started = mount().catch(');
 const context=vm.createContext({document,supabase,packageFields:'id',packageCard:()=>new Element('article'),started:null});
 vm.runInContext(source,context);await context.started;
 const all=host.all();const form=all.find(n=>n.tag==='form');
 const input=name=>all.find(n=>n.name===name);
 for(const [name,value] of Object.entries({title:'Creator package',deliverables:'A detailed video deliverable.',price:'125.50',revisions:'2',turnaround_days:'7',usage_rights:'Organic use for thirty days.'}))input(name).value=value;
 all.find(n=>n.tag==='input'&&n.value==='youtube').checked=true;
 const status=all.find(n=>n.role==='status');const save=all.find(n=>n.textContent==='Save package');
 return {input,status,save,all,writes:()=>writes,submit:()=>form.listeners.submit({preventDefault(){}})};
}
test('package save requires a returned database row',async()=>{
 const f=await fixture({data:null,error:null});await f.submit();
 assert.match(f.status.textContent,/could not be saved/);assert.equal(f.save.disabled,false);
});
test('package save handles network failures and permits retry',async()=>{
 const f=await fixture(new Error('offline'));await f.submit();
 assert.match(f.status.textContent,/could not be saved/);assert.equal(f.save.disabled,false);
});
test('confirmed package save reports success',async()=>{
 const f=await fixture();await f.submit();assert.equal(f.status.textContent,'Package saved.');assert.equal(f.writes(),1);
});
test('invalid numeric or blank trimmed fields never reach the database',async()=>{
 for(const [name,value] of [['price','Infinity'],['price','-1'],['revisions','1.5'],['turnaround_days','366'],['title','  '],['deliverables','short']]){
  const f=await fixture();f.input(name).value=value;await f.submit();assert.equal(f.writes(),0);assert.equal(f.save.disabled,false);
 }
});
test('package needs an included platform',async()=>{
 const f=await fixture();f.all.filter(n=>n.tag==='input').forEach(n=>n.checked=false);await f.submit();
 assert.match(f.status.textContent,/at least one platform/);assert.equal(f.writes(),0);
});
