(() => {
 'use strict';
 const base='assets/generated/story238/';
 const packs=[
  {sku:'welcome_garden',product:'mm_welcome_garden',id:'collection_pack_welcome',name:'Welcome Garden',w:2,h:1,chapter:0,description:'A sunflower farm sign and two matching planters, arranged as one movable garden display.',contents:['Sunflower farm sign','Two matching flower planters'],heightScale:2.4},
  {sku:'coop_charm',product:'mm_coop_charm',id:'collection_pack_coop',name:'Coop Charm',w:1,h:1,chapter:1,description:'A carved rooster ornament, flower boxes and a blue picket panel, arranged as one movable coop-side display.',contents:['Painted rooster ornament','Daisy flower boxes','Blue country picket panel'],heightScale:3.4},
  {sku:'market_makeover',product:'mm_market_makeover',id:'collection_pack_market',name:'Market Makeover',w:2,h:1,chapter:3,description:'A striped awning, hanging chalkboard and produce crates, arranged as one movable market display.',contents:['Striped market awning','Hanging chalkboard','Apple, carrot and cabbage display'],heightScale:2.6}
 ].map(p=>({...p,art:base+p.sku+'-r0.webp',thumb:base+p.sku+'-thumb.webp',kind:'collection',set:'Harvest Fair keepsakes',theme:'story',effect:'none',rarity:'keepsake',purchaseOnly:true,walkable:false,price:0}));
 window.meadowPackCatalog=packs;
})();
