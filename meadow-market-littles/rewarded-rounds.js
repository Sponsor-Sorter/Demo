/* Optional native advertisement, then exactly one verified round for that game. */
(() => {
 'use strict';
 function create({ads,access,commerce,consentReady}){
  const cloud=()=>window.meadowLittlesCloud;let caps=null,policy={enabled:false},epoch=0,refreshing=null,diagnosticBinding=null;
  const bindDiagnostics=(result,kind)=>{diagnosticBinding=result?.diagnosticKind===kind&&Number.isSafeInteger(result.diagnosticGeneration)&&result.diagnosticGeneration>0?{kind,generation:result.diagnosticGeneration}:null;return result;};
  const same=(stamp,actor)=>stamp===epoch&&actor===cloud()?.getStatus().userId;
  const call=(action,data={})=>{const selected=caps;if(!selected)throw Error('AD_UNAVAILABLE');return cloud().rewarded(action,{...data,client:selected.client,nativeVersion:selected.nativeVersion});};
  const core=window.meadowRewardedRoundCore.create({
   storage:localStorage,context:()=>({actor:cloud()?.getStatus().userId,plus:commerce().plus,parentReady:cloud()?.getStatus().parentReady===true,canRequestAds:consentReady(),remainingBaseRounds:id=>access.remainingBase(id)}),
   policy:()=>caps?policy:{enabled:false},prepare:data=>call('prepare',data),
   show:async({unit,challenge})=>{if(unit!==caps?.unit)throw Error('AD_UNAVAILABLE');const stamp=epoch,actor=cloud()?.getStatus().userId;diagnosticBinding=null;try{const result=await ads.showRewarded({challenge});return same(stamp,actor)?bindDiagnostics(result,'publisher'):result;}catch(error){if(['Optional adverts are unavailable.','Optional advert is not ready.'].includes(error?.message))return {closed:true,earned:false,unavailable:true};throw error;}},
   settle:data=>call('claim',data),verifyGrant:async receipt=>receipt.verified===true&&receipt.client===caps?.client&&receipt.unit===caps?.unit,
  });
  access.configure({rewarded:core});
  async function refresh(){
   if(refreshing)return refreshing;const stamp=epoch,actor=cloud()?.getStatus().userId;policy={enabled:false};
   const pending=(async()=>{try{
    if(!actor||!ads)return;
    const result=await ads.rewardedCapabilities();
    if(!same(stamp,actor)||result.contract!=='littles-ad-round-v1'||result.package!=='com.meadowmarket.littles'||!Number.isSafeInteger(result.nativeVersion)||result.nativeVersion<15||result.demo!==false||result.format!=='opt_in_skippable_rewarded_interstitial_v1'||typeof result.client!=='string'||!(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/).test(result.client)||typeof result.unit!=='string'||!(/^ca-app-pub-[0-9]+\/[0-9]+$/).test(result.unit))return;
    caps=result;const status=await call('status');if(!same(stamp,actor)||caps!==result||status.unit!==result.unit)return;
    // Older native builds may recover a genuinely earned receipt, but never start a new ad.
    policy={...status,enabled:status.enabled===true&&result.nativeVersion>=17};
    for(const game of core.pendingGames()){if(!same(stamp,actor))return;await core.recover(game);}
   }catch{if(same(stamp,actor))policy={enabled:false};}})();
   refreshing=pending;try{return await pending;}finally{if(refreshing===pending)refreshing=null;}
  }
  async function watch(game){const stamp=epoch,actor=cloud()?.getStatus().userId;let result=await core.watch(game);for(const delay of [500,1000,1500,2000]){if(result.status!=='pending')break;await new Promise(resolve=>setTimeout(resolve,delay));if(!same(stamp,actor))return {status:'account_changed'};result=await core.recover(game);}return result;}
  function cancel(){if(core.getStatus().phase==='preparing')core.accountChanged();ads?.cancelRewardedLoad?.().catch(()=>{});}
  function accountChanged(){epoch++;caps=null;policy={enabled:false};refreshing=null;diagnosticBinding=null;core.accountChanged();ads?.cancelRewardedLoad?.().catch(()=>{});}
  const diagnosticsAvailable=()=>caps?.diagnostics===true&&typeof ads?.rewardedDiagnostics==='function';
  const diagnostics=async request=>{if(!diagnosticsAvailable()||!Number.isSafeInteger(request)||request<1||request>1000000)throw Error('AD_UNAVAILABLE');const stamp=epoch,actor=cloud()?.getStatus().userId,binding=diagnosticBinding;const value=await ads.rewardedDiagnostics({request});if(!same(stamp,actor)||binding!==diagnosticBinding||binding&&(value?.kind!==binding.kind||value?.generation!==binding.generation))throw Error('AD_UNAVAILABLE');return value;};
  const diagnosticAdAvailable=()=>diagnosticsAvailable()&&typeof ads?.showDiagnosticRewarded==='function';
  const diagnosticAd=async()=>{if(!diagnosticAdAvailable())throw Error('AD_UNAVAILABLE');const stamp=epoch,actor=cloud()?.getStatus().userId;diagnosticBinding=null;const result=await ads.showDiagnosticRewarded();return same(stamp,actor)?bindDiagnostics(result,'demo'):result;};
  return {refresh,watch,available:core.available,canCheck:core.canCheck,remaining:core.remaining,cancel,accountChanged,diagnosticsAvailable,diagnostics,diagnosticAdAvailable,diagnosticAd};
 }
 window.meadowLittlesRewarded={create};
})();
