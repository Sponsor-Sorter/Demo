(() => {
 'use strict';
 const directions=[[0,1],[1,0],[1,1],[1,-1],[0,-1],[-1,0],[-1,-1],[-1,1]];
 function shuffle(a,r){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
 function make(words,size=16,random=Math.random,previous={}){
  if(words.length!==20||new Set(words.map(w=>w.label)).size!==20||words.some(w=>!w.label||w.label.length>size))throw Error('A puzzle needs twenty distinct words that fit.');
  for(let attempt=0;attempt<100;attempt++){
   const cells=Array(size*size).fill(''),answers=[];
   for(const word of shuffle(words,random).sort((a,b)=>b.label.length-a.label.length)){
    const candidates=[];
    for(let row=0;row<size;row++)for(let col=0;col<size;col++)for(const[dr,dc]of directions){const endR=row+dr*(word.label.length-1),endC=col+dc*(word.label.length-1);if(endR<0||endC<0||endR>=size||endC>=size)continue;const indices=Array.from({length:word.label.length},(_,i)=>(row+dr*i)*size+col+dc*i);if(previous[word.id]?.includes(indices.join('.'))||indices.some((n,i)=>cells[n]&&cells[n]!==word.label[i]))continue;candidates.push(indices)}
    if(!candidates.length)break;const indices=candidates[Math.floor(random()*candidates.length)];indices.forEach((n,i)=>cells[n]=word.label[i]);answers.push({...word,indices});
   }
   if(answers.length===words.length){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ';return {cells:cells.map(c=>c||alphabet[Math.floor(random()*26)]),answers,signature:answers.map(w=>w.id+'='+w.indices.join('.')).sort().join(';')}}
  }
  throw Error('Could not create a fresh puzzle. Please try again.');
 }
 window.meadowWordCore={make,directions};
})();
