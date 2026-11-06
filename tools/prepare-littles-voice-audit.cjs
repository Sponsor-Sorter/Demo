const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'../meadow-market-littles'),out=path.resolve(__dirname,'../.artifacts/littles-voice-audit');fs.mkdirSync(out,{recursive:true});
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const world=vm.runInNewContext(read('world-play.js').match(/const catalog=([\s\S]*?)\.map\(\(\[id,name,farmer/)[1]);
const next=vm.runInNewContext(read('next-games.js').match(/const defs=([\s\S]*?)\.map\(\(\[id,name,person/)[1]);
const together=vm.runInNewContext('('+read('together-core.js').match(/const games = ([\s\S]*?);\s*const produce/)[1]+')');
const cues=[];const add=(id,farmer,text)=>cues.push({id,farmer,text});
world.forEach(([id,name,farmer,scene,text])=>add('world-'+id,farmer,text));
next.forEach(([id,name,farmer,scene,voice,text])=>add('next-'+id,farmer,text));
Object.entries(together).filter(([id])=>!['connectfour','tictactoe','rps','memoryduel'].includes(id)).forEach(([id,g])=>add('together-'+id,'jay',g.text));
add('ws-jade-intro','jade','Find the little words. Put your finger on the first letter and slide across each letter in the word.');
add('ws-jade-done','jade','Well done! You found all the words! Great job! Shall we find some more?');
['Well done!','Great job!','You found it!','What a clever word finder!'].forEach((text,i)=>add('ws-jade-praise-'+i,'jade',text));
add('creative-jade-kitchen','jade','Let’s make a little farm treat! Tap some harvest foods to put them in your bowl. Then tap make it. You can choose any mix you like!');
add('creative-jade-band','jade','Let’s make a little farm tune! Tap a sound, then try another. Tap hear our tune to listen to your song.');
for(const farmer of ['jade','rhys','jay'])add('creative-'+farmer+'-served',farmer,'Yum! What a lovely farm treat! Thank you for sharing. Shall we make another?');
const coop=[['intro','Let’s build a cosy coop for the hens! We’ll put the pieces together, hammer the nails, paint the roof and make three soft nests. Take your time!'],['floor','First, drag three floor boards onto the outlines. One, two, three.'],['walls','Now fit the walls. Look at the shapes and slide each piece into its matching space.'],['roof','Put the two roof pieces on top. Match each triangle to its outline.'],['nails','Tap the shiny nails to hammer them in. Three gentle taps on each nail.'],['paint','Choose a colour. Then move your finger across the roof to paint it.'],['nests','Let’s make three soft nests. Drag a bundle of straw into each nest.'],['done','What lovely building! Your hens have a cosy new home. Look, they’ve laid some eggs! Shall we build another coop?']].map(([id,text])=>({id:'coop-rhys-'+id,farmer:'rhys',text}));
const legacy=[
['minigame-eggs-levels','jay','Catch the falling eggs before they reach the floor. Tap each egg to save it!'],
['minigame-milk-levels','jade','Let’s collect some milk. Tap when the moving marker is inside the golden zone. Give your hand a little rest between squeezes.'],
['minigame-flowers-levels','jade','Watch the flowers. Tap the flower that is glowing. Then look for the next glowing flower!'],
['minigame-memory-levels','jade','Turn over two cards and look at their pictures. Find all the matching pairs. Listen to the names and remember where each picture is hiding.'],
['minigame-sorting-levels','jay','Look at the food on the counter. Tap the basket with the same picture to put it away.'],
['minigame-differences','rhys','Look at both farm pictures. Can you spot what is different? Tap each change in either picture.'],
['minigame-drawing','rhys','Let’s draw a farm picture! Choose a pencil, brush, marker or crayon. Pick your colours and draw with your finger. You can undo a mark or start another picture.'],
['minigame-colourbynumber','jade','Let’s colour a farm picture! Choose a numbered paint. Find the same number in the picture. Use your brush, or tap with the bucket to fill the whole space.'],
['minigame-matchpainting','jay','Look at the little coloured picture. Choose your paints and colour your big picture to match. You can use your brush or the bucket.'],
['market-welcome','jay','Welcome to our little farm market! You can pack a picture order, or help weigh the harvest. Choose what you would like to try.'],
['market-pack','jay','Look at the order picture. Tap the matching food to put it in the basket. Keep packing until the order is ready.'],
['market-weigh','jay','Let’s weigh the harvest! Watch the moving marker. Tap weigh when it is inside the golden zone.'],
['market-result-win','jay','Lovely helping! Your market order is ready. Shall we visit the market again?'],
['animals-welcome','jay','Welcome to our farm friends! Choose an animal to feed, brush or play with. Take your time and give them some gentle care.']
];
legacy.forEach(([id,farmer,text])=>add('approved-'+id,farmer,text));
for(const word of ['apple','carrot','tomato','corn','pumpkin','strawberry','pear','banana','orange','grapes','watermelon','lemon','cucumber','potato','onion','broccoli','peas','pepper'])add('approved-produce-'+word,'jade',word[0].toUpperCase()+word.slice(1)+'.');
for(const farmer of ['jade','rhys','jay'])fs.writeFileSync(path.join(out,farmer+'.json'),JSON.stringify(cues.filter(c=>c.farmer===farmer),null,2));
fs.writeFileSync(path.join(out,'rhys-extra.json'),JSON.stringify(cues.filter(c=>c.farmer==='rhys'&&c.id.startsWith('approved-')),null,2));
fs.writeFileSync(path.join(out,'coop.json'),JSON.stringify(coop,null,2));console.log(JSON.stringify({out,counts:Object.fromEntries(['jade','rhys','jay'].map(f=>[f,cues.filter(c=>c.farmer===f).length]))}));
