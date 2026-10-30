const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('meadow-and-market/compact-hud.js','utf8'),game=fs.readFileSync('meadow-and-market/game.js','utf8'),css=fs.readFileSync('meadow-and-market/compact-hud.css','utf8');
assert.match(game,/links\.id='world-links';cameraScene\.append\(links\)/,'Travel controls must not inherit camera zoom/pan');
assert.match(css,/#world-links\{[^}]*pointer-events:none/);
assert.match(css,/#world-links \.area-path\{[^}]*top:var\(--hud-world-links-top,116px\)[^}]*min-height:44px/);
for(const [width,height,headerBottom]of [[390,844,104],[844,390,108],[1280,720,112]]){
 const values={},brand={left:12,right:225,bottom:headerBottom-8},title={left:300,right:460,bottom:54,width:160},header={bottom:headerBottom};
 const document={getElementById:()=>({getBoundingClientRect:()=>width<410?{width:0,bottom:0}:title}),querySelector:s=>({getBoundingClientRect:()=>s==='.topbar'?header:brand}),documentElement:{style:{setProperty:(k,v)=>values[k]=v}}};
 const scope={document,innerWidth:width};vm.createContext(scope);vm.runInContext(source.match(/ function noticeAnchor\([^\n]+/)[0]+source.match(/ function positionToast\([^\n]+/)[0]+';positionToast()',scope);
 assert.equal(values['--hud-world-links-top'],headerBottom+8+'px');
 assert(parseFloat(values['--hud-world-links-top'])+44<height-100,'Travel controls remain above bottom HUD');
}
console.log('Travel controls: screen anchored, below measured HUD, 44px touch target; portrait/short landscape/wide bounds passed.');
