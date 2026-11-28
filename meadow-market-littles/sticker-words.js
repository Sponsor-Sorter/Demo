/* Pictures are the choices; words appear on the writing page after selection. */
window.meadowStickerWords = [
  ...['car','boy','girl'].map((word,frame)=>({word,sheet:'assets/generated/writing/sticker-people-car.webp',frame})),
  ...['cat','dog','pig','hat','mat','log','frog','bee','tree','key','boat','coat','bus','sun','bed','pen'].map(word=>({word,image:'assets/generated/learning56/'+word+'.webp',audio:['mat','log','tree','key'].includes(word)?'learn56-rhys-word-'+word:'ws-word-'+word})),
  {word:'cow',image:'assets/generated/cow.webp'},
  {word:'hen',image:'assets/generated/hen.webp'},
  {word:'duck',image:'assets/generated/play-pieces/duck.webp'},
  {word:'apple',image:'assets/generated/minigames/produce/apple.webp'}
];
