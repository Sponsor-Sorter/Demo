(() => {
 const sets=[
 ['Harvest basket','🥕','carrot potato pumpkin tomato cucumber beetroot radish turnip parsnip spinach cabbage broccoli cauliflower lettuce celery onion garlic pepper zucchini aubergine'],
 ['Orchard picking','🍎','apple pear peach plum apricot cherry nectarine orange lemon lime mandarin grapefruit fig quince persimmon mulberry walnut almond chestnut hazelnut'],
 ['Berry patch','🍓','strawberry raspberry blueberry blackberry gooseberry cranberry currant bramble runner blossom pollinator picking basket jam preserve compote cordial crumble tart sweetness'],
 ['Grain fields','🌾','wheat barley oats rye maize millet sorghum quinoa buckwheat spelt harvest threshing winnowing combine granary chaff husk straw flour silo'],
 ['Barnyard','🐄','chicken rooster pullet hen chick cow bull calf heifer sheep lamb ram ewe goat kid billy nanny alpaca pony donkey'],
 ['Animal care','🪣','feeding watering grooming brushing shearing hoof pasture bedding shelter trough manger halter harness leadrope veterinary vaccine health comfort friendship enrichment'],
 ['Dairy morning','🥛','milking bucket cream butter cheese yoghurt curds whey churn udder pail dairy rennet starter culture strainer cooling separator pasture bottle'],
 ['Bee garden','🐝','hive apiary honey nectar pollen queen worker drone swarm comb wax propolis smoker veil frame extractor blossom pollination forage lavender'],
 ['Flower borders','🌷','sunflower lavender daisy tulip rose marigold poppy dahlia zinnia cosmos peony iris pansy violet primrose foxglove hollyhock lupin aster petunia'],
 ['Garden herbs','🌿','basil thyme rosemary sage mint parsley coriander dill chives oregano tarragon fennel sorrel marjoram lovage chervil savory chamomile lemonbalm borage'],
 ['Soil science','🪴','compost humus mulch loam clay sand silt mineral nitrogen phosphate potassium fertility drainage moisture aeration earthworm microbe acidity rotation fallow'],
 ['Farm tools','🔧','spade shovel rake hoe fork trowel secateurs shears dibber wheelbarrow wateringcan hose sprinkler mattock scythe sickle pitchfork mallet hammer wrench'],
 ['Tractor shed','🚜','tractor engine piston gearbox clutch throttle steering axle wheel tyre tread bonnet radiator diesel filter exhaust plough cultivator harrow trailer'],
 ['Building day','🏡','timber lumber plank joist rafter beam brace nail screw bolt washer hinge latch gate fence post rail roof shingle foundation'],
 ['Farm kitchen','🍞','bread flour dough yeast kneading proving baking crust crumb loaf sourdough pastry pie tart biscuit cake scone muffin butter oven'],
 ['Preserving shed','🫙','preserve jam jelly marmalade chutney relish pickle vinegar brine sugar simmer sterilise jar lid seal funnel ladle fruit pectin syrup'],
 ['Market morning','🧺','vendor customer stall basket crate display price bargain receipt order delivery harvest produce weighing scales stock shelf checkout coin profit'],
 ['Craft workshop','🧶','wool fleece yarn spinning spindle loom weaving knitting crochet needle bobbin thread fabric blanket scarf mittens dye pattern stitch felt'],
 ['Riverbank','🌉','river stream creek brook bank bridge ford current ripple pebble reed rush willow alder otter heron kingfisher dragonfly waterlily wetland'],
 ['Woodland trail','🌲','oak pine birch beech ash elm maple cedar hazel holly moss fern lichen mushroom acorn cone bark canopy clearing woodland'],
 ['Meadow wildlife','🦋','badger fox hedgehog rabbit hare squirrel vole mouse shrew deer owl robin sparrow swallow finch butterfly moth beetle cricket ladybird'],
 ['Seasons','☀️','spring summer autumn winter sunshine rainfall drizzle thunder lightning rainbow frost snow hail breeze gale drought thaw solstice equinox harvest'],
 ['Farmstead life','🏠','homestead farmhouse courtyard porch pantry cellar attic chimney hearth firewood laundry clothesline lantern kettle teapot breakfast supper picnic family neighbour'],
 ['Sustainable farm','♻️','renewable solar windmill turbine rainwater compost recycling habitat hedgerow biodiversity conservation stewardship ecosystem organic permaculture covercrop intercropping watershed carbon resilience'],
 ['Meadow adventures','🗺️','jade rhys jay willowbrook sunpetal pinecone goldenridge eastbank meadow orchard pasture coast village bakery wharf emporium friendship journey discovery community']
 ];
 const scenes=['assets/generated/minigames/meadow.webp','assets/generated/market/farmers-market.webp','assets/generated/minigames/tractor-scene.webp'];
 window.meadowWordTopics=sets.map(([name,icon,words],i)=>({id:'farm-'+i,name,icon,scene:scenes[i%scenes.length],words:words.split(' ').map(w=>[w,icon])}));
})();
