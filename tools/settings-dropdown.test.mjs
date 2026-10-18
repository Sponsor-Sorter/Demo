import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsDropdownPosition, anchorSettingsDropdown } from '../js/settingsDropdown.mjs';
const rect={left:534,right:566,top:196,bottom:244};
function harness(){
 const events={},docEvents={},triggerEvents={},panelEvents={},frames=[];const properties={};const attrs={};let anchor={...rect};let focused=false;
 const win={innerWidth:603,innerHeight:764,addEventListener:(name,fn)=>events[name]=fn,requestAnimationFrame:fn=>{frames.push(fn);return frames.length;}};
 const doc={addEventListener:(name,fn)=>docEvents[name]=fn,body:{appendChild:el=>el.parentElement=doc.body},head:{appendChild:el=>doc.sheet=el},getElementById:()=>null,createElement:()=>({})};
 const trigger={getBoundingClientRect:()=>anchor,setAttribute:(k,v)=>attrs[k]=v,addEventListener:(name,fn)=>triggerEvents[name]=fn,contains:target=>target==='cog',focus:()=>focused=true};
 const panel={id:'settings-dropdown',ownerDocument:doc,addEventListener:(name,fn)=>panelEvents[name]=fn,style:{display:'none',setProperty:(key,value,priority)=>properties[key]={value,priority}},contains:target=>target==='menu'};
 const controls=anchorSettingsDropdown(trigger,panel,win);
 return {win,panel,doc,panelEvents,properties,attrs,events,docEvents,triggerEvents,controls,frames,setRect:value=>anchor=value,flush:()=>frames.splice(0).forEach(fn=>fn()),focused:()=>focused};
}
test('desktop menu is eight pixels below the cog and aligned to its right edge',()=>{
 const p=settingsDropdownPosition(rect,{width:603,height:764});assert.equal(p.top,252);assert.equal(p.left+p.width,566);assert.equal(p.maxHeight,330);
});
test('narrow screens keep the menu inside both viewport edges',()=>{
 const p=settingsDropdownPosition({left:290,right:318,top:24,bottom:52},{width:320,height:600});assert.equal(p.width,304);assert.equal(p.left,8);assert.equal(p.top,60);
});
test('height is limited to space below the cog rather than shifting away',()=>{
 const p=settingsDropdownPosition({left:200,right:228,top:400,bottom:430},{width:600,height:500});assert.equal(p.top,438);assert.equal(p.maxHeight,54);
});
test('open overrides conflicting legacy position, transforms and margins',()=>{
 const h=harness();h.controls.open();assert.equal(h.panel.style.display,'block');assert.equal(h.attrs['aria-expanded'],'true');
 for(const key of ['position','top','left','right','transform','margin','width','min-width'])assert.equal(h.properties[key].priority,'important');
 assert.equal(h.properties.position.value,'fixed');assert.equal(h.properties.top.value,'252px');assert.equal(h.properties.transform.value,'none');assert.equal(h.properties.margin.value,'0');
});
test('scroll follows the cog and coalesces layout work into one frame',()=>{
 const h=harness();h.controls.open();h.setRect({...rect,top:146,bottom:194});h.events.scroll();h.events.scroll();assert.equal(h.frames.length,1);h.flush();assert.equal(h.properties.top.value,'202px');
});
test('resize keeps the dropdown clamped on mobile',()=>{
 const h=harness();h.controls.open();h.win.innerWidth=320;h.setRect({left:285,right:313,top:30,bottom:58});h.events.resize();h.flush();assert.equal(h.properties.width.value,'304px');assert.equal(h.properties.left.value,'8px');
});
test('a scrolled-away cog cannot leave an orphaned floating menu',()=>{
 const h=harness();h.controls.open();h.setRect({...rect,top:-100,bottom:-50});h.events.scroll();h.flush();assert.equal(h.panel.style.display,'none');assert.equal(h.attrs['aria-expanded'],'false');
});
test('inside clicks preserve menu; outside click closes it',()=>{
 const h=harness();h.controls.open();h.docEvents.click({target:'menu'});assert.equal(h.panel.style.display,'block');h.docEvents.click({target:'outside'});assert.equal(h.panel.style.display,'none');
});
test('Escape closes the menu and returns focus to the cog',()=>{
 const h=harness();h.controls.open();h.docEvents.keydown({key:'Escape'});assert.equal(h.panel.style.display,'none');assert.equal(h.focused(),true);
});
test('cog toggles without an immediate outside-click close',()=>{
 const h=harness();let stopped=0;h.triggerEvents.click({stopPropagation:()=>stopped++});assert.equal(h.panel.style.display,'block');h.triggerEvents.click({stopPropagation:()=>stopped++});assert.equal(h.panel.style.display,'none');assert.equal(stopped,2);
});

test('reopening starts at first setting instead of retaining old scroll',()=>{const h=harness();h.panel.scrollTop=250;h.controls.open();assert.equal(h.panel.scrollTop,0);});

test('menu is portaled outside navigation and gets scoped row styles',()=>{const h=harness();assert.equal(h.panel.parentElement,h.doc.body);assert.match(h.doc.sheet.textContent,/#settings-dropdown ul/);assert.match(h.doc.sheet.textContent,/transition:none!important/);});
test('settings action closes menu and updates expanded state',()=>{const h=harness();h.controls.open();h.panelEvents.click({target:{closest:()=>({})}});assert.equal(h.panel.style.display,'none');assert.equal(h.attrs['aria-expanded'],'false');});
test('toggle interaction preserves open menu',()=>{const h=harness();h.controls.open();h.panelEvents.click({target:{closest:()=>null}});assert.equal(h.panel.style.display,'block');});
