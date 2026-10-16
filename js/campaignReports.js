import { supabase } from './supabaseClient.js';

export function observedMetrics(input={}) {
 const result={};for(const key of ['views','likes','comments','shares','video_views','impressions','reach','saved','engagement','reactions','engaged_users','post_media_view','post_total_media_view_unique']){
  if(!(key in input))continue;const value=input[key];result[key]=['number','string'].includes(typeof value) && String(value).trim()!=='' && Number.isFinite(Number(value)) && Number(value)>=0 && Number(value)<=Number.MAX_SAFE_INTEGER ? Number(value):null;
 }return result;
}
export function reportCsv(rows){
 const cell=value=>{let text=String(value??'');if(/^[=+\-@\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
 return [['Recorded at (UTC)','Platform','Content URL','Source','Views','Likes','Comments','Shares'],...rows.map(r=>[r.recorded_at,r.platform,r.content_url,'Browser observation; not independently verified',r.metrics.views,r.metrics.likes,r.metrics.comments,r.metrics.shares])].map(row=>row.map(cell).join(',')).join('\r\n');
}
export async function mountCampaignReport(host,offerId){
 host.textContent='Loading campaign history…';
 const {data,error}=await supabase.from('campaign_metric_history').select('id,content_url,platform,metrics,recorded_at,observation_source').eq('offer_id',offerId).order('recorded_at',{ascending:false}).limit(200);
 if(error){host.textContent='Campaign history could not be loaded. Please retry.';return;}
 const heading=document.createElement('h3');heading.textContent='Campaign performance history';
 const note=document.createElement('p');note.textContent='Up to 200 most recent observations. These are saved browser observations, not independently verified platform measurements. Missing values stay unknown. Content Performance checks supported services when you open it; background refresh is not yet enabled.';
 const latest=data?.[0];const freshness=document.createElement('p');freshness.textContent=latest?'Last recorded: '+new Date(latest.recorded_at).toLocaleString()+'. Values may be stale.':'No observations saved yet. Open Content Performance to check linked content. Failed checks do not erase previous observations.';
 host.replaceChildren(heading,note,freshness);if(!data?.length)return;
 const download=document.createElement('button');download.type='button';download.textContent='Download report CSV';download.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob(['\uFEFF'+reportCsv(data)],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='sponsor-sorter-campaign-report.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});host.append(download);
 const scroll=document.createElement('div');scroll.style.overflowX='auto';scroll.tabIndex=0;scroll.setAttribute('aria-label','Campaign observations table');
 const table=document.createElement('table');table.style.width='100%';const thead=document.createElement('thead');const headers=document.createElement('tr');for(const label of ['Recorded','Platform','Views','Likes','Comments','Shares','Content']){const th=document.createElement('th');th.scope='col';th.textContent=label;headers.append(th);}thead.append(headers);table.append(thead);
 const tbody=document.createElement('tbody');for(const row of data){const tr=document.createElement('tr');for(const value of [new Date(row.recorded_at).toLocaleString(),row.platform,row.metrics.views,row.metrics.likes,row.metrics.comments,row.metrics.shares]){const td=document.createElement('td');td.textContent=value==null?'—':String(value);tr.append(td);}const cell=document.createElement('td');try{const url=new URL(row.content_url);if(url.protocol==='https:'&&!url.username&&!url.password){const link=document.createElement('a');link.href=url.href;link.rel='noopener noreferrer';link.target='_blank';link.textContent='View content';cell.append(link);}}catch{}tr.append(cell);tbody.append(tr);}table.append(tbody);scroll.append(table);host.append(scroll);
}
