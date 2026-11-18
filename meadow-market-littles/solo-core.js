/* Bounded preschool challenges for four existing solo activities. */
(() => {
  'use strict';
  const milestones = [1, 4, 9, 16, 25, 36];
  const catalog = [
    {id:'hiding_friend', kind:'hide', name:'Find the Hiding Farm Friend', farmer:'jade', scene:'learning56/freeze-scene.webp', intro:'world-hiding_friend', description:'Move the hay, listen and bring our farm friends home.'},
    {id:'shape_shadows', kind:'shapes', name:'Farm Shape Shadow Match', farmer:'rhys', scene:'learning56/patchwork-scene.webp', intro:'solo85-rhys-shapes-intro', description:'Fit chunky wooden shapes and open the farm windows.'},
    {id:'first_sounds', kind:'first', name:'Farm First Sounds', farmer:'jade', scene:'play-scenes/kitchen-room.webp', intro:'solo85-jade-first-intro', description:'Listen to a word and find the letter that comes first.'},
    {id:'little_bridge_builders', kind:'bridge', name:'Little Bridge Builders', farmer:'rhys', scene:'learning56/rolling-scene.webp', intro:'world-little_bridge_builders', description:'Fit the wooden planks and help Clover cross the stream.'}
  ];
  const animals = ['hen', 'cow', 'sheep', 'goat'];
  const shapes = ['circle', 'square', 'triangle', 'rect', 'oval', 'diamond'];
  const words = ['apple', 'banana', 'carrot', 'corn', 'orange', 'pear', 'potato', 'pumpkin', 'strawberry', 'tomato', 'watermelon'];
  const letters = [...new Set(words.map(w => w[0].toUpperCase()))];
  const rng = seed => () => ((seed = (Math.imul(seed,1664525) + 1013904223) >>> 0) / 4294967296);
  function shuffle(items, random) { const a=items.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
  function profile(level=1) { const n=Math.max(1,Math.floor(Number(level)||1)), stage=milestones.reduce((a,v,i)=>n>=v?i:a,0); return {level:milestones[stage], stage, choices:[2,3,4,4,5,6][stage], hidingChoices:[2,3,4,4,4,4][stage], friends:[1,1,1,2,2,3][stage], gaps:[1,1,1,2,2,3][stage], turns:stage>=2, smallLetters:stage>=3, mixedLetters:stage===5}; }
  function challenge(level, direction) { const p=profile(level); return milestones[Math.max(0,Math.min(5,p.stage+(direction<0?-1:1)))]; }
  function period(shape) { return shape==='circle'||shape==='square'?90:shape==='rect'||shape==='oval'||shape==='diamond'?180:360; }
  function sameTurn(shape, a, b) { return ((a-b)%period(shape)+period(shape))%period(shape)===0; }
  class Round {
    constructor(kind, {seed=1,level=1,index=0}={}) {
      if(!catalog.some(g=>g.kind===kind))throw Error('Unknown solo activity');
      this.kind=kind; this.profile=profile(level); this.random=rng((seed+Math.imul(index+1,2654435761))>>>0); this.misses=0; this.hint=null; this.done=false; this.serial=0;
      const p=this.profile, r=this.random;
      if(kind==='hide') { const friends=shuffle(animals,r).slice(0,p.hidingChoices); this.state={friends,revealed:[],found:[],requests:shuffle(friends,r).slice(0,p.friends),step:0}; }
      if(kind==='shapes') { const choices=shuffle(shapes.slice(0,p.choices),r), wanted=choices[Math.floor(r()*choices.length)], rotation=p.turns?Math.floor(r()*(p.stage>=3?4:2))*90:0; this.state={choices,wanted,rotation,turns:Object.fromEntries(choices.map(id=>[id,p.stage>=3?Math.floor(r()*4)*90:0]))}; }
      if(kind==='first') { const word=words[Math.floor(r()*words.length)], wanted=word[0].toUpperCase(), choices=shuffle([wanted,...shuffle(letters.filter(x=>x!==wanted),r).slice(0,p.choices-1)],r); this.state={word,wanted,choices,small:p.smallLetters,forms:Object.fromEntries(choices.map((id,i)=>[id,p.smallLetters&&(!p.mixedLetters||i%2)?id.toLowerCase():id]))}; }
      if(kind==='bridge') { const choices=shuffle(Array.from({length:p.choices},(_,i)=>i+1),r), wanted=Array.from({length:3},()=>choices[Math.floor(r()*choices.length)]),missing=shuffle([0,1,2],r).slice(0,p.gaps); this.state={choices,wanted,placed:wanted.map((_,i)=>!missing.includes(i)),initial:3-p.gaps}; }
    }
    result(ok, extra={}) { return {ok,done:this.done,misses:this.misses,...extra}; }
    ignored() { return this.result(false,{ignored:true}); }
    miss() { this.misses++; return this.result(false,{incorrect:true,hintReady:this.misses>=2}); }
    correct() { this.misses=0; this.hint=null; }
    progress() { const s=this.state; return this.kind==='hide'?{value:s.step,max:s.requests.length}:this.kind==='bridge'?{value:s.placed.filter(Boolean).length-s.initial,max:s.placed.length-s.initial}:{value:this.done?1:0,max:1}; }
    act(type, value={}) {
      if(this.done)return this.ignored();
      const s=this.state;
      if(this.kind==='hide') {
        const i=value.index;
        if(!Number.isInteger(i)||i<0||i>=s.friends.length)return this.ignored();
        if(type==='uncover') { if(s.revealed.includes(i))return this.ignored(); s.revealed.push(i); this.serial++; if(this.hint)this.requestHint(); return this.result(true,{uncovered:true}); }
        if(type!=='find'||!s.revealed.includes(i)||s.found.includes(i))return this.ignored();
        this.serial++;
        if(s.friends[i]!==s.requests[s.step])return this.miss();
        const foundId=s.friends[i]; s.found.push(i); s.step++; this.correct(); this.done=s.step===s.requests.length; if(!this.done&&this.profile.stage>=4){const home=s.found.map(j=>s.friends[j]);s.friends=shuffle(s.friends,this.random);s.found=home.map(id=>s.friends.indexOf(id));s.revealed=s.found.slice();}return this.result(true,{found:foundId,next:!this.done});
      }
      if(this.kind==='shapes') {
        if(!s.choices.includes(value.shape))return this.ignored();
        if(type==='turn') { s.turns[value.shape]=(s.turns[value.shape]+90)%360; this.serial++; if(this.hint)this.requestHint(); return this.result(true,{turned:true}); }
        if(type!=='fit')return this.ignored();
        this.serial++;
        if(value.shape!==s.wanted||!sameTurn(value.shape,s.turns[value.shape],s.rotation))return this.miss();
        this.done=true; this.correct(); return this.result(true,{fitted:true});
      }
      if(this.kind==='first') {
        if(type!=='letter'||!s.choices.includes(value.letter))return this.ignored();
        this.serial++;
        if(value.letter!==s.wanted)return this.miss();
        this.done=true; this.correct(); return this.result(true,{planted:true});
      }
      if(this.kind==='bridge') {
        if(type!=='place'||!Number.isInteger(value.gap)||value.gap<0||value.gap>=s.wanted.length||s.placed[value.gap]||!s.choices.includes(value.plank))return this.ignored();
        this.serial++;
        if(value.plank!==s.wanted[value.gap])return this.miss();
        s.placed[value.gap]=true; this.correct(); this.done=s.placed.every(Boolean); return this.result(true,{built:value.gap});
      }
      return this.ignored();
    }
    requestHint() {
      if(this.done||this.misses<2)return null;
      const s=this.state;
      if(this.kind==='hide') { const index=s.friends.indexOf(s.requests[s.step]); this.hint={uncover:s.revealed.includes(index)?null:index,friend:index,caption:s.revealed.includes(index)?'This is our friend. Help them come home.':'Move this hay bale, then find our friend.'}; }
      if(this.kind==='shapes')this.hint={source:s.wanted,turn:!sameTurn(s.wanted,s.turns[s.wanted],s.rotation),target:'window',caption:sameTurn(s.wanted,s.turns[s.wanted],s.rotation)?'This shape fits. Bring it to the window.':'Choose this shape. Turn it to match.'};
      if(this.kind==='first')this.hint={source:s.wanted,target:'seed',caption:'This letter comes first. Bring it to the seed packet.'};
      if(this.kind==='bridge') { const gap=s.placed.indexOf(false); this.hint={source:String(s.wanted[gap]),target:'gap-'+gap,caption:'This plank reaches across. Move it to the glowing gap.'}; }
      return this.hint;
    }
  }
  window.meadowSoloCore={catalog,milestones,profile,challenge,Round,animals,shapes,words,letters,rng,shuffle,sameTurn};
})();
