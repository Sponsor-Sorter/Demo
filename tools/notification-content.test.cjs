const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/notificationContent.js','utf8');
function render(notification){
 const nodes=[];
 const context={document:{createElement:tag=>({tag,style:{},set innerHTML(_){throw Error('Unsafe HTML sink');}})},Date,Number};
 vm.createContext(context);vm.runInContext(source.replace('export function','function'),context);
 context.appendNotificationContent({append:(...items)=>nodes.push(...items)},notification);return nodes;
}
test('notification markup remains literal text, including scripts and event handlers',()=>{
 const title='<img src=x onerror=alert(1)>',message='<script>steal()</script>\n<a href="javascript:steal()">Open</a>';
 const nodes=render({title,message});assert.equal(nodes.length,3);assert.equal(nodes[0].textContent,title);assert.equal(nodes[1].textContent,message);
 assert.ok(nodes.every(n=>n.tag==='div'));assert.equal(nodes[1].style.whiteSpace,'pre-wrap');
});
test('empty notifications and invalid dates render without misleading timestamps',()=>{
 for(const created_at of [null,'invalid']){const nodes=render({created_at});assert.equal(nodes[0].textContent,'[No Title]');assert.equal(nodes[1].textContent,'');assert.equal(nodes[2].textContent,'');}
 assert.ok(render({created_at:'2026-10-12T01:00:00Z'})[2].textContent);
});
test('shared notification dropdown uses the safe renderer',()=>{
 const alerts=fs.readFileSync('js/alerts.js','utf8');assert.match(alerts,/appendNotificationContent\(notif, n\)/);
 assert.doesNotMatch(alerts,/\$\{n\.(title|message)/);
});

test('notification inbox shares one initializer and supports keyboard controls',()=>{
 const alerts=fs.readFileSync('js/alerts.js','utf8');
 assert.ok(alerts.includes('if (document.documentElement.dataset.notificationsReady) return'));
 assert.ok(alerts.includes("document.documentElement.dataset.notificationsReady = 'true'"));
 assert.ok(alerts.includes("e.target.closest?.('#notification-bell')"));
 assert.ok(alerts.includes("e.key === 'Escape'"));
 const css=fs.readFileSync('notifications.css','utf8');
 assert.ok(css.includes('calc(100% - 24px)'));assert.ok(css.includes(':focus-visible'));
});


test('notification deep links reject selector injection and malformed identifiers',()=>{
 const alerts=fs.readFileSync('js/alerts.js','utf8');
 const fn=alerts.slice(alerts.indexOf('function jumpToOfferId('),alerts.indexOf('/** Poll for target'));
 let queries=0,scrolled=0;
 const context={document:{querySelector:()=>{queries++;return {scrollIntoView:()=>scrolled++}}},flashNode:()=>{}};
 vm.createContext(context);vm.runInContext(fn,context);
 for(const id of [null,42,'',']','x], body, [x=','javascript:alert(1)']) assert.equal(context.jumpToOfferId(id),false);
 assert.equal(queries,0);
 assert.equal(context.jumpToOfferId('00000000-0000-4000-8000-000000000001'),true);
 assert.equal(scrolled,1);
});
