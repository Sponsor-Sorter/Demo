(() => {
 'use strict';
 const stage=(name,gold,ask,reward)=>({name,gold,ask,reward});
 const projects=[
  {id:'outpost',name:'Roadside visitor post',person:'rhys',level:4,at:[26,60],width:18,art:'outpost',purpose:'Restore the visitor post at the town entrance beyond Eastbank. Meet the village and open the bakery project.',stages:[stage('Clear the doorway',90,{carrot:4,wheat:4},40),stage('Prepare the visitor baskets',150,{apple:6,egg:4},65),stage('Welcome the first visitors',240,{bread:3,milk:4},100)]},
  {id:'bakery',name:'Village bakery',person:'rhys',level:6,requires:['outpost',3],at:[52,54],width:18,art:'bakery',purpose:'Reopen the bakery for regular customers, signature baking and the animal nursery.',stages:[stage('Repair the roof',280,{wheat:12,wool:4},80),stage('Equip the kitchen',420,{flour:6,egg:6,milk:4},110),stage('Bake for opening day',600,{bread:8,jam:4,honey:3},160)]},
  {id:'cafe',name:'Meadow café',person:'jade',level:9,requires:['bakery',3],at:[75,65],width:18,art:'cafe',purpose:'Supply the café, grow specialist greenhouse crops and develop more valuable customer orders.',stages:[stage('Make it welcoming',500,{bouquet:4,soap:3,wool:6},120),stage('Stock the breakfast pantry',750,{bread:6,cheese:4,applepreserve:3},170),stage('Serve the first afternoon tea',1000,{honeycake:4,butter:4,jam:4},220)]},
  {id:'hall',name:'Community hall',person:'jay',level:12,requires:['cafe',2],at:[85,44],width:17,art:'hall',purpose:'Open the weekly country fair and invite friends to build shared village landmarks.',stages:[stage('Repair our meeting place',850,{yarn:6,wool:12,soap:4},180),stage('Prepare the country fair',1200,{bouquet:6,bread:8,cheese:6},250),stage('Celebrate together',1700,{scarf:4,honeycake:6,applepreserve:5},350)]},
  {id:'jetty',name:'Willow fishing jetty',person:'rhys',level:10,requires:['bakery',2],at:[17.5,34],width:23,art:'jetty',purpose:'Repair the river landing to fish, discover river life and supply new village recipes.',stages:[stage('Replace the broken planks',420,{wheat:10,wool:5},90),stage('Prepare the tackle hut',650,{yarn:4,bread:4,soap:3},130),stage('Open the riverside path',900,{cheese:5,honey:4,bouquet:3},200)]}
 ];
 const customers=[
  {id:'baker',name:'Mabel the baker',place:'Village bakery',project:'bakery',stage:2,person:'rhys',art:'bakery',orders:[{wheat:8,egg:4},{flour:5,milk:4},{bread:5,jam:3},{butter:4,egg:6}]},
  {id:'florist',name:'Fern the florist',place:'Roadside flower cart',project:'outpost',stage:3,person:'jade',art:'outpost',orders:[{lavender:8,nectar:5},{bouquet:4,honey:3},{soap:4,apple:6}]},
  {id:'cafe',name:'Oliver at the café',place:'Meadow café',project:'cafe',stage:2,person:'jay',art:'cafe',orders:[{bread:5,cheese:4},{honeycake:3,milk:6},{applepreserve:4,goatcheese:4}]},
  {id:'tailor',name:'Hazel the tailor',place:'Community craft table',project:'hall',stage:1,person:'rhys',art:'hall',orders:[{wool:10,fleece:5},{yarn:6,soap:3},{scarf:3,bouquet:3}]},
  {id:'river',name:'Willow riverside kitchen',place:'Riverside jetty',project:'jetty',stage:3,person:'jade',art:'jetty',orders:[{riverperch:2,wildherbs:2},{silvertrout:2,bread:3},{blackberry:4,hazelnut:3},{goldencarp:1,wildherbs:3}]}
 ];
 const careers=[
  {id:'jade',name:'Growing with Farmer Jade',stat:'harvest',steps:[10,40,100,250],levels:[5,8,12,18],costs:[180,420,850,1600],perks:['5% lower field seed costs','One extra crop per tile','10% lower field seed costs','Two extra crops per tile'],text:'Harvest crops and orchard fruit, then practise with Farmer Jade. Helpers count too.'},
  {id:'rhys',name:'Making with Farmer Rhys',stat:'craft',steps:[5,20,60,150],levels:[5,9,13,19],costs:[180,450,900,1700],perks:['5% faster production','10% faster production','15% faster production','20% faster production'],text:'Collect kitchen and workshop batches. New training shortens future batches; existing queues keep their promised times.'},
  {id:'jay',name:'Caring with Farmer Jay',stat:'care',steps:[10,35,90,200],levels:[5,8,12,18],costs:[180,420,850,1600],perks:['5% slower animal needs','One extra animal product','10% slower animal needs','Two extra animal products'],text:'Care for your animals. Training helps every species across every owned farm.'}
 ];
 const breeds={chicken:['Meadow hen','Speckled hen','Golden hen'],cow:['Meadow cow','Chestnut cow','Golden Guernsey'],sheep:['Meadow sheep','Spotted sheep','Silver fleece sheep'],goat:['Meadow goat','Brown alpine goat','Golden alpine goat'],alpaca:['Meadow alpaca','Chestnut alpaca','Silver alpaca']};
 const finds=[{id:'riverperch',name:'Willow river perch',sell:28,kind:'fishing',rarity:1},{id:'silvertrout',name:'Silver river trout',sell:46,kind:'fishing',rarity:2},{id:'goldencarp',name:'Golden willow carp',sell:75,kind:'fishing',rarity:3},{id:'blackberry',name:'Woodland blackberries',sell:18,kind:'woodland'},{id:'hazelnut',name:'Wild hazelnuts',sell:24,kind:'woodland'},{id:'wildherbs',name:'Wild cooking herbs',sell:20,kind:'woodland'}];
 window.meadowJourneyData={projects,customers,careers,breeds,finds};
})();
