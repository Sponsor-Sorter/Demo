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
