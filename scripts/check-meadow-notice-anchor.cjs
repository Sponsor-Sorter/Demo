const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),source=fs.readFileSync('meadow-and-market/compact-hud.js','utf8'),scope={};vm.createContext(scope);vm.runInContext(source.match(/ function noticeAnchor\([^\n]+/)[0],scope);
for(const width of [320,390,844,1200,2048]){const rect={left:width*.45,right:width*.65,bottom:72},point=scope.noticeAnchor(rect,width),half=Math.min(440,width-24)/2;assert.equal(point.top,78,'Notice starts exactly six pixels beneath the map title');assert(point.left-half>=12-1);assert(point.left+half<=width-12+1);if(width>=844)assert.equal(point.left,Math.round((rect.left+rect.right)/2),'Wide screens align the notice to the title, not the page centre');}
assert(source.includes("getElementById('map-title')"));assert(source.includes('notices.observe(mapTitle)'));
const css=fs.readFileSync('meadow-and-market/compact-hud.css','utf8');assert(css.includes('left:var(--hud-notice-left,50%)!important'));assert(css.includes('background:#6e503b;color:#fff9ec;'));
console.log('Brown notices: six pixels beneath farm-title bounds, title-centred on wide screens, safe phone edges and reactive title/viewport changes passed.');

assert(!fs.readFileSync('meadow-and-market/game.js','utf8').includes("Explore this part of your farm"),'Navigation must not cover destination animal controls with a redundant notice');
