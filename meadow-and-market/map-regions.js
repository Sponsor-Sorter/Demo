(() => {
  'use strict';
  // Percent coordinates traced against willowbrook-meadow-map.webp (1536×1024).
  // These live in camera-map coordinates, so zoom, pan and rotation cannot
  // independently move a clickable region away from the painted building.
  const regions={
    homestead:{label:'Visit farmhouse',view:'home',z:3,points:[[7.8,15.3],[11.5,11.2],[12,6.5],[20.1,10.3],[22.8,17],[22.3,24.5],[19.7,27.3],[10.6,25],[8,20.3]]},
    barnyard:{label:'Visit barn and animal yard',view:'animals',z:1,points:[[18.5,4.5],[22,0],[27,0],[32.6,4.5],[35.4,11],[34.7,18],[25,20],[23,16.5],[20,10.3],[18.5,9]]},
    'coop-yard':{label:'Visit original chicken yard',view:'animals',z:2,points:[[29.5,17.3],[40,14.1],[44.3,15.4],[45,19],[50,20],[51.3,24],[48.5,26.5],[40,27.3],[30.5,24.8]]},
    'orchard-area':{label:'Visit orchard and produce market',view:'market',z:1,points:[[35.5,0],[74,0],[74,4.4],[69.6,9.8],[65,14.1],[58.2,18.4],[53.5,20.5],[48.2,16.8],[42,13.6],[37.2,8.2]]},
    'bridge-area':{label:'Cross bridge to Eastbank Meadow · Level 4',view:'east',z:1,points:[[78.7,26],[83.3,27.4],[95.9,37.1],[94,40.9],[89.3,39.5],[77.5,31.1]]}
  };
  function bounds(points){const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}}
  function contains(points,x,y){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
  function mount(root){if(!root)return;for(const [id,r] of Object.entries(regions)){let el=root.querySelector('.'+id);if(!el){el=document.createElement('button');el.className='map-hotspot '+id;root.append(el)}el.dataset.mapView=r.view;el.setAttribute('aria-label',r.label);const b=bounds(r.points);for(const [key,value] of Object.entries({left:b.x+'%',top:b.y+'%',width:b.w+'%',height:b.h+'%',right:'auto','z-index':String(r.z),'clip-path':'polygon('+r.points.map(p=>(p[0]-b.x)/b.w*100+'% '+(p[1]-b.y)/b.h*100+'%').join(',')+')'}))el.style.setProperty(key,value,'important')}}
  window.meadowMapRegions={artSha256:"157ed7525c1b135712c40804ed27f2abf92593e57ce18a2e9d869516e6a16f34",regions,bounds,contains,mount};
})();
