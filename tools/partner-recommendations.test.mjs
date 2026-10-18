import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePartnerRecommendations, loadPartnerRecommendations } from '../js/partnerRecommendations.mjs';
import { rankPartners, terms } from '../js/partnerMatching.js';

const viewer='00000000-0000-4000-8000-000000000001';
const partner='00000000-0000-4000-8000-000000000002';
function response() { return {ok:true,mode:'partners',algorithm_version:'partner-v2',viewer_role:'sponsor',scoring:{max_points:105,score_type:'compatibility_points'},matches:[{partner_user_id:partner,sponsor_id:viewer,sponsee_id:partner,offer_id:null,match_score:35,raw_points:35,profile:{user_id:partner,username:'Test partner',userType:'besponsored',planType:'free',social_handles:{youtube:true},contenttype:'gaming',platforms:['youtube']},reasons:['Shared content interests: games'],missing:[],saved:false,followers:0,follower_data_status:'reported'}]}; }
test('public recommendation contract preserves zero and whitelists profile fields',()=>{
  const data=response();data.matches[0].profile.private_email='must not propagate';
  const result=validatePartnerRecommendations(data,viewer);
  assert.equal(result.matches[0].followers,0);assert.equal(result.matches[0].profile.private_email,undefined);assert.deepEqual(result.matches[0].reasons,['Shared content interests: games']);
});
test('creator viewer receives sponsor profile with correct actor relation',()=>{
  const data=response();data.viewer_role='besponsored';Object.assign(data.matches[0],{sponsor_id:partner,sponsee_id:viewer});data.matches[0].profile.userType='sponsor';
  assert.equal(validatePartnerRecommendations(data,viewer).viewerRole,'besponsored');
});
test('empty recommendations are valid, not transport failure',()=>{
  const data=response();data.matches=[];assert.deepEqual(validatePartnerRecommendations(data,viewer).matches,[]);
});
test('rejects legacy private-offer and incompatible algorithm response',()=>{
  for(const mutate of [d=>d.mode='offers',d=>d.algorithm_version='legacy',d=>d.matches[0].offer_id=partner,d=>d.matches[0].sponsor_id=partner,d=>d.matches[0].profile.user_id=viewer,d=>d.matches[0].profile.userType='sponsor']){
    const data=response();mutate(data);assert.throws(()=>validatePartnerRecommendations(data,viewer));
  }
});
test('rejects duplicate identities and oversized result counts',()=>{
  const data=response();data.matches.push(structuredClone(data.matches[0]));assert.throws(()=>validatePartnerRecommendations(data,viewer));
  assert.throws(()=>validatePartnerRecommendations(response(),viewer,0));
});
test('rejects arbitrary social handle JSON and nontext explanations',()=>{
  for(const mutate of [d=>d.matches[0].profile.social_handles.youtube='secret',d=>d.matches[0].profile.social_handles.unknown=true,d=>d.matches[0].reasons=[{}],d=>d.matches[0].missing=['x'.repeat(1001)],d=>d.matches[0].profile.username='x'.repeat(81)]){
    const data=response();mutate(data);assert.throws(()=>validatePartnerRecommendations(data,viewer));
  }
});
test('freshness and compatibility point bounds are enforced',()=>{
  for(const mutate of [d=>d.matches[0].followers=-1,d=>d.matches[0].followers=1.1,d=>d.matches[0].follower_data_status='verified',d=>d.matches[0].follower_data_status='stale',d=>d.matches[0].match_score=106,d=>d.matches[0].raw_points=99]){
    const data=response();mutate(data);assert.throws(()=>validatePartnerRecommendations(data,viewer));
  }
  const data=response();Object.assign(data.matches[0],{followers:null,follower_data_status:'stale'});assert.equal(validatePartnerRecommendations(data,viewer).matches[0].followers,null);
});
test('missing session makes no endpoint request',async()=>{
  let calls=0;const client={auth:{getSession:async()=>({data:{session:null}})},functions:{invoke:async()=>{calls++;}}};
  await assert.rejects(loadPartnerRecommendations(client),/Sign in/);assert.equal(calls,0);
});
test('one owner-authenticated call sends limit only with abort signal',async()=>{
  const requests=[];const controller=new AbortController();
  const client={auth:{getSession:async()=>({data:{session:{access_token:'test',user:{id:viewer}}}})},functions:{invoke:async(name,options)=>{requests.push({name,options});return {data:response()};}}};
  await loadPartnerRecommendations(client,{signal:controller.signal});
  assert.equal(requests.length,1);assert.deepEqual(requests[0].options.body,{limit:6});assert.equal(requests[0].name,'calculate_match_scores');assert.equal(requests[0].options.signal,controller.signal);
});
test('endpoint error is safe, no fallback scan or automatic retry',async()=>{
  let calls=0;const client={auth:{getSession:async()=>({data:{session:{access_token:'test',user:{id:viewer}}}})},functions:{invoke:async()=>{calls++;return {error:Error('private database detail')};}}};
  await assert.rejects(loadPartnerRecommendations(client),error=>!error.message.includes('private database'));assert.equal(calls,1);
});
test('Finder no longer duplicates ranking or scans candidate tables',()=>{
  const source=readFileSync(new URL('../js/recmatch.js',import.meta.url),'utf8');
  assert.match(source,/loadPartnerRecommendations\(supabase, \{ limit: 6, signal \}\)/);
  assert.doesNotMatch(source,/rankPartners|loadPartnerPreferences|public_user_directory|user_social_followers|match_scores/);
});

// Baseline parity cases for the backend overhaul. Production Finder no longer calls this legacy client ranker.
const sponsor={user_id:viewer,userType:'sponsor',username:'Sponsor',contenttype:'gaming',target_audience:'tech',platforms:['youtube'],preferred_content_format:'video',partnership_type:'one-time campaign',location:'UK',minfollowers:'10k'};
const creator={user_id:partner,userType:'besponsored',username:'Creator',contenttype:'gamer',target_audience:'technology',platforms:['youtube'],preferred_content_format:'video',partnership_type:'one-time campaign',location:'United Kingdom'};
test('baseline aliases and all component weights total105, not probability',()=>{
  const match=rankPartners(sponsor,[creator],{followers:{[partner]:10000}})[0];assert.equal(match.points,105);assert.equal(match.substantive,5);assert.match(match.reasons.join(' '),/Meets stated combined follower minimum/);assert.deepEqual(terms('USA,workout,X'),['united states','fitness','twitter']);
});
test('baseline unknown follower count gives caveat; known zero fails positive minimum',()=>{
  assert.match(rankPartners(sponsor,[creator])[0].missing.join(' '),/Follower requirement needs checking/);
  assert.equal(rankPartners(sponsor,[creator],{followers:{[partner]:0}}).length,0);
});
test('baseline known disjoint platforms excluded and location alone cannot earn recommendation',()=>{
  assert.equal(rankPartners(sponsor,[{...creator,platforms:['tiktok']}]).length,0);
  assert.equal(rankPartners({user_id:viewer,userType:'sponsor',location:'UK'},[{user_id:partner,userType:'besponsored',location:'UK'}]).length,0);
});
test('baseline filters same-role/self candidates and parses follower suffixes',()=>{
  assert.equal(rankPartners({...sponsor,minfollowers:'1M+'},[creator],{followers:{[partner]:999999}}).length,0);
  assert.equal(rankPartners(sponsor,[{...creator,user_id:viewer},{...creator,userType:'sponsor'}]).length,0);
});
