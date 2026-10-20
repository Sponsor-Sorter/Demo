import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const group=read('js/groupOffers.js');
function fn(name,next,context){
 const source=group.slice(group.indexOf('async function '+name+'('),group.indexOf(next,group.indexOf('async function '+name+'(')));
 return vm.runInNewContext(source+';'+name,context);
}
test('covered modules cannot create browser inbox rows or call alert producers',()=>{
 for(const file of ['js/groupOffers.js','js/friendGroups.js','js/reviewPage.js','newoffer.html','js/AffiliateDashboard.js','js/AffiliateAdmin.js','js/sponsorOffers.js']){
  assert.doesNotMatch(read(file),/notifyOfferUpdate|notifyGroupInvite|notifyInviteStatus|notifyNewOffer|notifyReview|insertNotification|from\(['"]user_notifications['"]\)/,file);
 }
});
test('member accept and reject retain canonical RPC and propagate errors',async()=>{
 for(const [name,next,response] of [['acceptOfferForMember','async function rejectOfferForMember','accepted'],['rejectOfferForMember','// ---------- NEW:','rejected']]){
  const calls=[];let failure=null;
  const action=fn(name,next,{supabase:{rpc:async(...args)=>{calls.push(args);return {error:failure};}}});
  await action({offer:{id:'owned-fixture'}});
  assert.equal(calls[0][0],'respond_group_offer'); assert.equal(calls[0][1].p_offer_id,'owned-fixture');assert.equal(calls[0][1].p_response,response);
  failure=new Error('denied');await assert.rejects(action({offer:{id:'owned-fixture'}}),/denied/);
 }
});
test('invitation actions preserve writes and refresh without recipient lookup',async()=>{
 let refreshed=0;const calls=[];
 const ctx={supabase:{rpc:async(...a)=>{calls.push(a);return {error:null};},from:t=>({update:v=>({eq:async(k,id)=>{calls.push([t,v,k,id]);return {error:null};}})})},refreshGroupsListUI:()=>refreshed++};
 await fn('acceptInvite','async function declineInvite',ctx)({id:'invite',group_id:'group'},{});
 await fn('declineInvite','async function renderPendingInvites',ctx)({id:'invite'},{});
 assert.equal(calls[0][0],'accept_group_invitation');assert.equal(calls[1][0],'friend_group_invites');assert.equal(calls[1][1].status,'declined');assert.equal(refreshed,1);
});
test('domain creation/review writes and retained producers remain',()=>{
 assert.match(read('newoffer.html'),/rpc\('prepare_sponsorship_order'/);
 assert.match(read('js/reviewPage.js'),/from\("private_offer_reviews"\)/);
 assert.match(read('js/friendGroups.js'),/from\('friend_group_invites'\)/);
 assert.match(read('js/AffiliateDashboard.js'),/callAffiliate\('wallet\/claim'/);
 assert.match(read('js/AffiliateAdmin.js'),/affiliate-admin\/applications/);
 assert.match(read('js/sponsorOffers.js'),/await handleRemoveOffer\(offerId\)/);
 assert.match(read('js/adminLogic.js'),/type: "admin"/);
 assert.match(read('js/alerts.js'),/export async function insertNotification/);
});
test('changed module consumers have fresh cache aliases',()=>{
 for(const [file,names] of [['dashboardsponsee.html',['groupOffers','friendGroups']],['review.html',['reviewPage']]])
  for(const name of names) assert.match(read(file),new RegExp(name+'\\.js\\?[^"\\s]*domainnotifications=20261020-1'));
});

test('nested consumers and sponsor inline import contain cache aliases inside URL',()=>{
 assert.match(read('dashboardsponsor.html'),/sponsorOffers\.js\?[^']*domainnotifications=20261020-1';<\/script>/);
 assert.match(read('dashboardAdmin.html'),/adminLogic\.js\?[^" ]*domainnotifications=20261020-1"/);
 assert.match(read('js/adminLogic.js'),/AffiliateAdmin\.js\?[^" ]*domainnotifications=20261020-1"/);
});
