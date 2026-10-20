import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createApplicantRow,escapeHtml,imageAttribute} from '../js/publicOfferPresentation.mjs';

class Element {
 constructor(tag){this.tagName=tag;this.style={};this.children=[];this.textContent='';this.disabled=false;this.attrs={};}
 append(...children){this.children.push(...children);} appendChild(child){this.append(child);return child;}
 setAttribute(key,value){this.attrs[key]=value;}
 querySelector(){return new Element('button');}
 contains(){return false;} addEventListener(){} remove(){}
}
const document={createElement:tag=>new Element(tag),addEventListener(){},querySelectorAll:()=>[]};
const text=element=>element.textContent+element.children.map(text).join('');
test('application markup and username stay literal and navigation is a closure',()=>{
 let destination;const row=createApplicantRow({id:'fixture',status:'pending',sponsee_username:`O'Neil <b>name</b>`,application_text:'<b>TEST_LITERAL_HTML</b>'},{profile_pic:'picture".png'},{document,parentAvailable:true,navigate:url=>destination=url});
 assert.ok(text(row).includes('<b>TEST_LITERAL_HTML</b>'));assert.ok(text(row).includes("O'Neil <b>name</b>"));
 assert.equal(row.innerHTML,undefined);assert.equal(row.children[0].children[0].src.includes('"'),false);
 row.children.find(e=>e.textContent==='View Profile').onclick();assert.equal(destination,`./viewprofile.html?username=${encodeURIComponent("O'Neil <b>name</b>")}`);
});
test('accept/remove retain the typed application ID and availability gating',()=>{
 const calls=[];const row=createApplicantRow({id:'fixture',status:'pending'},{},{document,parentAvailable:true,onAccept:id=>calls.push(id),onRemove:id=>calls.push(id)});
 const accept=row.children.find(e=>e.textContent==='Accept');accept.onclick();assert.equal(accept.disabled,true);assert.deepEqual(calls,['fixture']);
 row.children.find(e=>e.textContent==='Remove').onclick();assert.deepEqual(calls,['fixture','fixture']);
 const closed=createApplicantRow({id:'fixture',status:'pending'},{},{document,parentAvailable:false});assert.ok(!closed.children.some(e=>e.textContent==='Accept'));assert.equal(closed.children.find(e=>e.textContent==='Remove').disabled,true);
});
test('unsafe image schemes and quoted attributes cannot enter HTML',()=>{
 assert.equal(imageAttribute('javascript:TEST'),'logos.png');assert.ok(!imageAttribute('https://example.com/picture".png').includes('"'));assert.equal(escapeHtml('<b>literal</b>'),'&lt;b&gt;literal&lt;/b&gt;');
});
function renderer() {
 const source=readFileSync(new URL('../js/publicOffers.js',import.meta.url),'utf8').replace(/^import .*;\r?$/gm,'').replace(/^export /gm,'');
 const client={from:()=>{const chain={select(){return this;},eq(){return this;},single(){return Promise.resolve({data:{profile_pic:'a".png',company_name:'<b>company</b>'}});},then(resolve){return Promise.resolve({count:1,data:[]}).then(resolve);}};return chain;},storage:{from:()=>({getPublicUrl:path=>({data:{publicUrl:'https://example.com/'+path}})})}};
 const context=vm.createContext({window:{location:{origin:'https://example.com'},addEventListener(){}},document,supabase:client,escapeHtml,imageAttribute,createApplicantRow,publicOfferAvailability:()=>({available:true}),console,URL,encodeURIComponent});
 vm.runInContext(source,context);return context;
}
const offer={id:'00000000-0000-4000-8000-000000000001',sponsor_username:'<b>name</b>',offer_title:'<b>title</b>',offer_description:'<b>description</b>',instructions:'<b>instructions</b>',sponsor_company:'<b>company</b>',status:'open',offer_amount:10,platforms:['youtube','"<b>platform</b>'],offer_images:['a".png'],min_followers:'<b>followers</b>'};
test('actual sponsor and creator card templates escape stored display fields',async()=>{
 const context=renderer();context.offer=offer;
 const sponsor=await vm.runInContext('renderSponsorOfferCard(offer)',context);
 const creator=await vm.runInContext("renderSponseePublicOfferAppCard({id:'fixture',status:'pending'},offer)",context);
 for(const card of [sponsor,creator]) {assert.ok(card.innerHTML.includes('&lt;b&gt;title&lt;/b&gt;'));assert.ok(card.innerHTML.includes('&lt;b&gt;description&lt;/b&gt;'));assert.ok(!card.innerHTML.includes('<b>description</b>'));assert.ok(!card.innerHTML.includes('src="https://example.com/a".png"'));}
});
test('actual details and apply modal templates escape stored text',()=>{
 const context=renderer();context.offer=offer;const appended=[];
 context.document={...document,body:{appendChild:modal=>appended.push(modal)},getElementById:()=>new Element('button')};
 vm.runInContext('window.showOfferDetailsModal(offer); window.showApplyModal(offer)',context);
 for(const modal of appended)assert.ok(modal.innerHTML.includes('&lt;b&gt;title&lt;/b&gt;'));
 assert.ok(appended[0].innerHTML.includes('&lt;b&gt;instructions&lt;/b&gt;'));
});
