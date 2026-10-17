import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const logic=readFileSync(new URL('../js/sponseeLogic.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const finder=readFileSync(new URL('../finder.html',import.meta.url),'utf8').replace(/\r\n/g,'\n');
test('Pro limit-card hide overrides a stylesheet display important rule',async()=>{
  const start=logic.indexOf('async function loadFreePlanLimitCard()');
  const end=logic.indexOf('\nasync function updateSummaryStats()',start);
  const properties=[];
  const card={style:{setProperty:(...args)=>properties.push(args)}};
  const client={auth:{getUser:async()=>({data:{user:{id:'fixture'}}})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{planType:'pro'},error:null})})})})};
  const run=new Function('supabase','document',logic.slice(start,end)+';return loadFreePlanLimitCard();');
  await run(client,{getElementById:id=>{assert.equal(id,'free-plan-limit-card');return card;}});
  assert.deepEqual(properties,[['display','none','important']]);
});
function browseHandler(){
  const start=finder.indexOf("  document.addEventListener('click', (event) => {",finder.indexOf('  offerSearchToggle.onclick'));
  const end=finder.indexOf('\n  });',start)+6;
  let handler,clicked=0,scrolled=0;
  new Function('document','offerSearchToggle','offerSearchBlock',finder.slice(start,end))({addEventListener:(name,callback)=>{assert.equal(name,'click');handler=callback;}},{click:()=>clicked++},{scrollIntoView:()=>scrolled++});
  return {run:handler,result:()=>({clicked,scrolled})};
}
test('dynamically created browse link opens offers in Finder without sponsor navigation',()=>{
  assert.match(finder,/class="finder-recent-link" href="#offer-search-form-block"/);
  const h=browseHandler();let prevented=false;
  h.run({target:{closest:selector=>{assert.equal(selector,'a.finder-recent-link');return {};}},preventDefault:()=>prevented=true});
  assert.equal(prevented,true);assert.deepEqual(h.result(),{clicked:1,scrolled:1});
});
test('unrelated clicks do not switch Finder modes',()=>{const h=browseHandler();h.run({target:{closest:()=>null},preventDefault:()=>assert.fail('unrelated event')});assert.deepEqual(h.result(),{clicked:0,scrolled:0});});
