const fs=require('fs');
const posts=require('../content/blog-editorial.cjs');
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function html(raw){return raw.trim().split(/\n\s*\n/).map(block=>{block=block.trim();if(block.startsWith('<'))return block;if(block.startsWith('## ')){const [heading,...rest]=block.split('\n');return '<h2>'+escape(heading.slice(3))+'</h2>'+ (rest.length?'\n'+html(rest.join('\n')):'');}if(block.startsWith('- '))return '<ul>'+block.split('\n').map(line=>'<li>'+escape(line.replace(/^- /,''))+'</li>').join('')+'</ul>';return '<p>'+escape(block).replaceAll('\n',' ')+'</p>';}).join('\n');}
fs.mkdirSync('assets/blog',{recursive:true});
const motifs={
sponsor:'<circle cx="330" cy="260" r="75"/><circle cx="630" cy="260" r="75"/><path d="M405 260H555M435 230L465 260 435 290M525 230L495 260 525 290"/>',
creator:'<rect x="260" y="160" width="440" height="250" rx="28"/><path d="M440 220L550 285 440 350Z"/><circle cx="660" cy="195" r="8"/>',
pricing:'<path d="M480 150V390M300 210H660M350 210L280 330H420ZM610 210L540 330H680ZM410 400H550"/><circle cx="480" cy="150" r="15"/>',
brief:'<rect x="320" y="120" width="320" height="330" rx="22"/><path d="M370 190H570M370 250H550M370 310H520M370 370H480"/>',
experiment:'<rect x="240" y="180" width="200" height="220" rx="20"/><rect x="520" y="180" width="200" height="220" rx="20"/><path d="M290 340L340 240 390 340M310 300H370M570 240V340H620Q680 315 620 290Q680 265 620 240Z"/>',
ugc:'<rect x="240" y="170" width="220" height="230" rx="18"/><rect x="540" y="170" width="180" height="230" rx="18"/><path d="M320 225L400 285 320 345ZM485 285H515M575 350L605 315 650 335 690 270"/>',
approval:'<path d="M240 290H720"/><circle cx="290" cy="290" r="45"/><circle cx="480" cy="290" r="45"/><circle cx="670" cy="290" r="45"/><path d="M267 290L285 310 315 270M457 290L475 310 505 270M647 290L665 310 695 270"/>',
disclosure:'<rect x="260" y="150" width="440" height="260" rx="22"/><rect x="300" y="190" width="160" height="65" rx="10"/><path d="M325 235L340 205 355 235M330 225H350M375 205V235H390Q415 220 390 205ZM300 300H650M300 350H570"/>',
analytics:'<path d="M260 150V410H720M310 350L390 300 470 330 560 240 650 190"/><circle cx="390" cy="300" r="12"/><circle cx="560" cy="240" r="12"/>',
security:'<path d="M480 125L640 190V290Q630 390 480 450Q330 390 320 290V190ZM410 280L460 330 555 230"/>',
connections:'<path d="M270 180H480V300H690M270 180V390H480V300M690 180V390H480"/><circle cx="270" cy="180" r="26"/><circle cx="480" cy="300" r="32"/><circle cx="690" cy="390" r="26"/><circle cx="690" cy="180" r="26"/>'};
for(const [key,motif]of Object.entries(motifs)){fs.writeFileSync('assets/blog/'+key+'.svg',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" role="img"><title>${key} editorial illustration</title><defs><linearGradient id="bg"><stop stop-color="#07111e"/><stop offset="1" stop-color="#122a39"/></linearGradient><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#244455" stroke-width="1"/></pattern><linearGradient id="light"><stop stop-color="#6f79ff"/><stop offset="1" stop-color="#65edee"/></linearGradient></defs><rect width="960" height="540" fill="url(#bg)"/><rect width="960" height="540" fill="url(#grid)" opacity=".5"/><circle cx="480" cy="280" r="205" fill="#081522" opacity=".85"/><g stroke="url(#light)" stroke-width="7" stroke-linejoin="round" stroke-linecap="round" fill="#0c1e2b">${motif}</g><path d="M75 450H180M780 90H885" stroke="#4bc7df" stroke-width="3"/><circle cx="180" cy="450" r="5" fill="#67efff"/></svg>`);}
const records=posts.map((p,i)=>({legacy:p.legacy,slug:p.slug,title:p.title,category:p.category,tags:p.tags,excerpt:p.excerpt,content:html(p.body),cover_image:'/assets/blog/'+p.art+'.svg',author_name:'Sponsor Sorter editorial',published:true,is_featured:i<3}));
fs.writeFileSync('content/blog-release.json',JSON.stringify(records,null,2)+'\n');
console.log(records.map((p,i)=>`${i+1}. ${p.slug}: ${p.content.replace(/<[^>]*>/g,' ').split(/\s+/).length} words`).join('\n'));
