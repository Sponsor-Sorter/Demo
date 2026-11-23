// Service-to-service evidence contract. Never import a caller-supplied identity.
export const securityContractVersion=1;
export const securitySources={
 frontlines:['frontliners-service100','frontliners-commerce','fairplay-gift-codes'],
 meadow:['meadow-market-farm-actions','meadow-market-store','meadow-market-ad-reward','fairplay-gift-codes'],
 littles:['littles-play-store','littles-cloud-save','fairplay-gift-codes']
};
export const securityRules=[
 {id:'request_integrity',name:'Request integrity',description:'A validated request reference was reused with different authoritative content.',codes:['request_payload_conflict'],mode:'flag',threshold:3,window_minutes:15,severity:'high'},
 {id:'receipt_integrity',name:'Purchase receipt integrity',description:'A verified purchase conflicts with its recorded account or product binding.',codes:['receipt_binding_conflict'],mode:'flag',threshold:3,window_minutes:15,severity:'high'},
 {id:'reward_integrity',name:'Reward integrity',description:'A verified reward or redemption conflicts with its authoritative binding.',codes:['reward_binding_conflict','gift_payload_conflict'],mode:'flag',threshold:3,window_minutes:15,severity:'high'},
 {id:'entitlement_integrity',name:'Entitlement integrity',description:'A server-authoritative operation contains an unsupported paid entitlement claim.',codes:['entitlement_claim_mismatch'],mode:'observe',threshold:5,window_minutes:15,severity:'medium'},
 {id:'save_integrity',name:'Save integrity',description:'A server rejects a save against an authoritative resource invariant. Legacy drift is excluded.',codes:['save_resource_violation'],mode:'observe',threshold:5,window_minutes:15,severity:'medium'},
 {id:'match_integrity',name:'Game action integrity',description:'A server rejects a structurally impossible action or round sequence. Turn, revision, quota and network conflicts are excluded.',codes:['match_action_invalid','round_sequence_invalid'],mode:'observe',threshold:5,window_minutes:15,severity:'medium'}
];
export const securityContextFields=['operation','match_id','request_id','correlation_hash','build','protocol','provider','field','expected','observed','revision','verification_stage'];
export function validateSecuritySignal(p){
 const bad=()=>{throw Error('Invalid service security evidence');};
 if(!p||Object.keys(p).some(k=>!['app','actor','event_id','source','code','context'].includes(k)))bad();
 if(!securitySources[p.app]?.includes(p.source)||!securityRules.some(r=>r.codes.includes(p.code)))bad();
 const uuid=v=>typeof v==='string'&&/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(v);
 if(!uuid(p.actor)||!uuid(p.event_id))bad();
 const c=p.context;
 if(!c||Array.isArray(c)||typeof c!=='object'||Object.keys(c).some(k=>!securityContextFields.includes(k))||!/^[a-f\d]{64}$/.test(c.correlation_hash||''))bad();
 for(const [k,v]of Object.entries(c))if(!['string','number','boolean'].includes(typeof v)||(typeof v==='string'&&(v.length>160||/[\r\n\x00-\x1f]/.test(v)))||(typeof v==='number'&&(!Number.isSafeInteger(v)||Math.abs(v)>1e12)))bad();
 return {p_app:p.app,p_actor:p.actor,p_event_id:p.event_id,p_source:p.source,p_code:p.code,p_context:{...c}};
}
export function validateDetectionRule(input){
 if(!input||Object.keys(input).some(k=>!['app','rule_id','revision','mode','threshold','window_minutes','reason','confirmation'].includes(k)))throw Error('Unknown detection rule field');
 if(!securitySources[input.app]||!securityRules.some(r=>r.id===input.rule_id)||!['off','observe','flag'].includes(input.mode)||!Number.isInteger(input.revision)||input.revision<1||!Number.isInteger(input.threshold)||input.threshold<2||input.threshold>50||!Number.isInteger(input.window_minutes)||input.window_minutes<1||input.window_minutes>1440||typeof input.reason!=='string'||input.reason.trim().length<5||input.reason.length>1000||input.confirmation!=='RULES '+input.app)throw Error('Valid rule, revision, reason and exact confirmation required');
 return {...input,reason:input.reason.trim()};
}
// A failed observation must never change an already determined game/commerce result.
// Call after a rejected transaction has rolled back; inserts before RAISE disappear.
export async function emitSecuritySignal(rpc,p,{onFailure=()=>{}}={}){
 try{const result=await rpc('fairplay_game_security_signal_v1',validateSecuritySignal(p));if(result?.error)throw Error('Security evidence rejected');const value=result?.data??result;if(typeof value?.accepted!=='boolean')throw Error('Invalid evidence acknowledgement');return value;}
 catch{try{onFailure({event:'security_evidence_unavailable',app:p?.app,source:p?.source,code:p?.code});}catch{}return {accepted:false,unavailable:true};}
}
