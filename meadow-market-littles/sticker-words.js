/* Pictures are the choices; words appear on the writing page after selection. */
window.meadowStickerWords = [
  ...['car','boy','girl'].map((word,frame)=>({word,sheet:'assets/generated/writing/sticker-people-car.webp',frame})),
  ...['cat','dog','pig','hat','mat','log','frog','bee','tree','key','boat','coat','bus','sun','bed','pen'].map(word=>({word,image:'assets/generated/learning56/'+word+'.webp',audio:['mat','log','tree','key'].includes(word)?'learn56-rhys-word-'+word:'ws-word-'+word})),
  {word:'cow',image:'assets/generated/cow.webp'},
  {word:'hen',image:'assets/generated/hen.webp'},
  {word:'duck',image:'assets/generated/play-pieces/duck.webp'},
  {word:'apple',image:'assets/generated/minigames/produce/apple.webp'}
];

/* Separate export keeps cached renderer2 clients on their original 23 pictures. */
window.meadowExtraStickerWords = [
  ...['cup','egg','bag','box','teddy','ball'].map((word,frame)=>({word,sheet:'assets/generated/writing/everyday-a103.png',frame,columns:3,rows:2})),
  ...['book','milk','sock','shoe','barn','corn'].map((word,frame)=>({word,sheet:'assets/generated/writing/everyday-b103.png',frame,columns:3,rows:2})),
  ...['fish','fox','owl','bunny','pony','chick'].map((word,frame)=>({word,sheet:'assets/generated/writing/animal-friends103.png',frame,columns:3,rows:2})),
  {word:'goat',image:'assets/generated/goat.webp'},
  {word:'sheep',image:'assets/generated/sheep.webp'}
];

/* Renderer5 unlocks these at quality105; older cached clients keep their43. */
window.meadowNewestStickerWords = [
  ...['lamb','calf','horse','goose'].map((word,frame)=>({word,sheet:'assets/generated/writing/farm-friends-a105.png',frame,columns:2,rows:2})),
  ...['ram','mouse','snail','ant'].map((word,frame)=>({word,sheet:'assets/generated/writing/farm-friends-b105.png',frame,columns:2,rows:2})),
  ...['bug','deer','hay','gate'].map((word,frame)=>({word,sheet:'assets/generated/writing/farm-things105.png',frame,columns:2,rows:2})),
  ...['cart','home','hand','nose'].map((word,frame)=>({word,sheet:'assets/generated/writing/everyday-c105.png',frame,columns:2,rows:2})),
  ...['eyes','baby','bath','train'].map((word,frame)=>({word,sheet:'assets/generated/writing/everyday-d105.png',frame,columns:2,rows:2}))
];
