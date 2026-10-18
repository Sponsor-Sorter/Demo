const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),root=path.resolve(__dirname,'../meadow-and-market'),read=n=>fs.readFileSync(path.join(root,n),'utf8'),scope={window:{}};
vm.runInNewContext(read('barns.js'),scope);const barns=scope.window.meadowBarns;
assert.equal(barns.stages.length,4);assert.equal(new Set(barns.stages.map(s=>s.file)).size,4);
for(let i=0;i<4;i++){const stage=barns.stages[i];assert(stage.pad>0&&stage.pad<25);assert(fs.existsSync(root+'/'+barns.image(i)));assert.equal(barns.pad(i),stage.pad)}
assert.equal(barns.image(99),barns.image(3));assert.equal(barns.image(-1),barns.image(0));
const game=read('game.js');assert(game.includes('window.meadowBarns.image(barnTier(o))'));assert(game.includes('window.meadowBarns.pad(barnTier(o))'));assert(game.includes('window.meadowBarns.image(tier)'));assert(game.includes('class="barn-stage-thumb"'));assert(game.includes('Grand Livestock Barn'));assert(!game.includes('Eight cows can live here'));
assert(read('style.css').includes('transform:translateY(var(--barn-pad-bottom,8.453%))'));
console.log('Four distinct barn stages, authored aspect ratio, ground anchors and livestock wording passed.');
