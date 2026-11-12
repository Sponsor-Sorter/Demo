(() => {
 'use strict';
 const base='assets/generated/story238/',packs=window.meadowPackCatalog||[];

 let api,dialog,selected,rotation=0,version=0,busy=false,error='';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const owned=p=>window.meadowStore?.owned(p.sku)===true;
 const placed=p=>Object.values(api.state().farms).some(f=>f.objects.some(o=>o.type===p.id));
 function card(sku){const p=packs.find(p=>p.sku===sku);return p&&window.meadowStore?.offerVisible(sku)?'<button class="story-pack-teaser" data-story-pack="'+p.sku+'"><img src="'+p.thumb+'" alt=""><span><strong>'+p.name+'</strong><small>Optional cosmetic set · '+esc(owned(p)?'Owned':window.meadowStore?.label(p.sku)||'View pack')+'</small></span><span aria-hidden="true">›</span></button>':'';}
 function bind(root){root.querySelectorAll('[data-story-pack]').forEach(b=>b.onclick=()=>open(b.dataset.storyPack));}
 function close(){if(busy)return;version++;dialog?.close();}
 function draw(){
  const p=selected;if(!dialog||!p)return;
  const has=owned(p),store=window.meadowStore,canBuy=store?.canPurchase(p.sku)===true;
  dialog.innerHTML='<section class="story-pack-reader"><header><div><small>HARVEST FAIR KEEPSAKES</small><h2>'+p.name+'</h2></div><button class="close-button" id="story-pack-close" aria-label="Return to previous screen" '+(busy?'disabled':'')+'>×</button></header><main><div class="story-pack-preview"><img src="'+base+p.sku+'-r'+rotation+'.webp" alt="'+p.name+' · view '+(rotation+1)+'"><div class="story-pack-turns" role="group" aria-label="Preview all four sides">'+[0,1,2,3].map(r=>'<button data-pack-turn="'+r+'" aria-label="View '+(r+1)+'" aria-pressed="'+(r===rotation)+'">'+(r*90)+'°</button>').join('')+'</div></div><div class="story-pack-copy"><p>'+p.description+'</p><ul>'+p.contents.map(c=>'<li>'+c+'</li>').join('')+'</ul><p class="story-pack-facts">One arrangement · '+p.w+'×'+p.h+' tiles · four rotations<br>Permanent account ownership · cosmetic only</p><p role="status" id="story-pack-status">'+esc(error)+'</p>'+(has?(p.sku==='welcome_garden'?'<label class="story-sign-label">Your farm sign<input id="story-sign-text" maxlength="20" value="'+esc(api.state().keepsakeLabels?.[p.id]||'Our farm')+'"><button class="small-button" id="story-sign-save">Save sign text</button></label>':'')+'<button class="primary-button" id="story-pack-place" '+(placed(p)?'disabled':'')+'>'+(placed(p)?'Already placed on a farm':'Place on my farm')+'</button>':'<button class="primary-button" id="story-pack-buy" '+(!canBuy||busy?'disabled':'')+'>'+esc(busy?'Confirming purchase…':store?.label(p.sku)||'Connect to see price')+'</button>')+'<button class="small-button" id="story-pack-later" '+(busy?'disabled':'')+'>Back to my game</button><small>Farm progression and story rewards remain available through play. No random contents or subscription.</small></div></main></section>';
  dialog.querySelector('#story-pack-close').onclick=close;dialog.querySelector('#story-pack-later').onclick=close;
  dialog.querySelectorAll('[data-pack-turn]').forEach(b=>b.onclick=()=>{rotation=Number(b.dataset.packTurn);draw();});
  dialog.querySelector('#story-pack-place')?.addEventListener('click',()=>{if(!owned(p)||placed(p))return;close();document.getElementById('farm-club')?.close();document.getElementById('modal-dialog')?.close();api.build(p.id);});
  dialog.querySelector('#story-pack-buy')?.addEventListener('click',buy);
  dialog.querySelector('#story-sign-save')?.addEventListener('click',()=>{const text=dialog.querySelector('#story-sign-text').value.trim();if(!text||text.length>20||/[\u0000-\u001f\u007f<>]/.test(text)){error='Use 1–20 characters for your sign.';draw();return;}if(window.meadowCommandUI?.active())window.meadowCommandUI.route('keepsake.label',p.id,{text},api.state().active,{after:()=>{api.render();if(dialog.open){error='Your sign text is saved.';draw();}}});else{api.state().keepsakeLabels||={};api.state().keepsakeLabels[p.id]=text;api.save();api.render();error='Your sign text is saved.';draw();}});
 }
 async function open(sku){if(!api?.canPlay())return api?.notify('Return to your farm to open a keepsake.');const p=packs.find(p=>p.sku===sku);if(!p||busy)return;selected=p;rotation=0;error='';const ticket=++version;dialog.showModal();draw();try{await window.meadowStore.refresh();if(ticket===version&&dialog.open)draw();}catch(e){if(ticket===version&&dialog.open){error=e.message;draw();}}}
 async function buy(){if(busy||!selected)return;const p=selected,who=api.user()?.id;busy=true;error='';draw();try{const r=await window.meadowStore.purchase(p.sku);if(r?.test){await api.flush();const response=await api.client().rpc('meadow_market_claim_test_story_pack',{p_sku:p.sku});if(response.error)throw Error(response.error.message);if(who!==api.user()?.id)throw Error('Account changed. Open the pack on its own farm.');}
   if(who!==api.user()?.id)throw Error('Account changed. Open the pack on its own farm.');
   await window.meadowStore.refresh();await window.meadowCollections.refresh();if(r?.delivered||r?.test){window.meadowAudio?.play('reward');error='Your keepsake is ready. Place it now or keep it for later.';}else if(r?.cancelled)error='Purchase cancelled. No items were added.';else error='Payment is pending. Your keepsake will arrive after Google confirms it.';
  }catch(e){error=e.message;}finally{busy=false;if(dialog.open)draw();}}
 function attach(a){api=a;dialog=document.createElement('dialog');dialog.id='story-pack-dialog';dialog.className='story-pack-dialog';dialog.setAttribute('aria-label','Harvest Fair keepsake');dialog.addEventListener('cancel',e=>{e.preventDefault();close();});document.body.append(dialog);}
 window.meadowStoryPacks={packs,card,bind,open,attach};
})();
