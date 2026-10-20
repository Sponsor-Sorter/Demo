(() => {
  'use strict';
  let layer=null,original=null,ghostArt=null,signature='';
  function clear(){layer?.remove();layer=null;ghostArt?.remove();ghostArt=null;original?.classList.remove('placement-origin');original=null;signature=''}
  function box(el,x,y,w,h,rows){const cols=14,step=100/((cols+rows)/2),bx=50-(cols-rows)*step/4,by=50-(cols+rows-2)*step/4,width=(w+h)*step/2,height=width,cx=bx+(x-y+(w-h)/2)*step/2,cy=by+(x+y+(w+h-2)/2)*step/2;Object.assign(el.style,{left:(cx-width/2)+'%',top:(cy-height/2)+'%',width:width+'%',height:height+'%'});}
  function show({grid,item,source,cell,fp,rows,valid}){
    const key=[item.id||item.type,cell.x,cell.y,fp.w,fp.h,valid].join(':');if(layer?.isConnected&&signature===key)return;clear();signature=key;
    layer=document.createElement('div');layer.className='placement-preview '+(valid?'placement-valid':'placement-blocked');layer.setAttribute('role','status');layer.setAttribute('aria-label',(valid?'Clear placement':'Blocked placement')+' · '+fp.w+' by '+fp.h+' tiles');
    for(let y=cell.y;y<cell.y+fp.h;y++)for(let x=cell.x;x<cell.x+fp.w;x++){const tile=document.createElement('i');tile.className='placement-tile';box(tile,x,y,1,1,rows);layer.append(tile)}
    if(source){const ghost=source.cloneNode(true);ghost.removeAttribute('id');ghost.removeAttribute('data-id');ghost.removeAttribute('aria-label');ghost.removeAttribute('tabindex');ghost.setAttribute('aria-hidden','true');ghost.classList.remove('selected','movable','hold-pending','placement-origin');ghost.classList.add('placement-ghost');ghost.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));box(ghost,cell.x,cell.y,fp.w,fp.h,rows);ghostArt=ghost;grid.append(ghost);if(source.isConnected){original=source;source.classList.add('placement-origin')}}
    const label=document.createElement('span');label.className='placement-label';label.textContent=valid?'Release to place':'Blocked · release to return';box(label,cell.x,cell.y,fp.w,fp.h,rows);layer.append(label);grid.append(layer);
  }
  window.meadowPlacement={show,clear,box};
})();
