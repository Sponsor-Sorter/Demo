const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),root=path.resolve(__dirname,'../meadow-and-market'),read=n=>fs.readFileSync(path.join(root,n),'utf8'),scope={window:{}};
vm.runInNewContext(read('barns.js'),scope);const barns=scope.window.meadowBarns;
assert.equal(barns.stages.length,4);assert.equal(new Set(barns.stages.map(s=>s.file)).size,4);
for(let i=0;i<4;i++){const stage=barns.stages[i];assert(stage.pad>0&&stage.pad<25);assert(fs.existsSync(root+'/'+barns.image(i)));assert.equal(barns.pad(i),stage.pad)}
assert.equal(barns.image(99),barns.image(3));assert.equal(barns.image(-1),barns.image(0));
const game=read('game.js');assert(game.includes('window.meadowBarns.image(barnTier(o))'));assert(game.includes('window.meadowBarns.pad(barnTier(o))'));assert(game.includes('window.meadowBarns.image(tier)'));assert(game.includes('class="barn-stage-thumb"'));assert(game.includes('Grand Livestock Barn'));assert(!game.includes('Eight cows can live here'));
assert(read('style.css').includes('transform:translateY(var(--barn-pad-bottom,8.453%))'));
console.log('Four distinct barn stages, authored aspect ratio, ground anchors and livestock wording passed.');

// Visible foundation corners map to the selected 4×3 tiles.
const g=barns.stages[3].grid,projection=barns.groundProjection(3),point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]],near=(a,b)=>a.forEach((v,i)=>assert(Math.abs(v-b[i])<1e-7));
assert.equal(g.w,4);assert.equal(g.h,3);assert.equal(barns.groundProjection(0),null);
near(point(projection.left,g.left),[0,3/7*1000]);near(point(projection.left,g.front),[4/7*1000,1000]);near(point(projection.right,g.front),[4/7*1000,1000]);near(point(projection.right,g.right),[1000,4/7*1000]);
for(const matrix of [projection.left,projection.right])assert.equal(matrix[2],0,'Vertical beams must stay vertical');
for(const y of [0,300,700,1254])near(point(projection.left,[g.front[0],y]),point(projection.right,[g.front[0],y]));
const art=barns.mapArt(3,'farm-barn-1');assert(art.includes('preserveAspectRatio="none"'));assert(art.includes('barn-grid-farm-barn-1-outline'));assert(art.includes(barns.image(3)));assert.equal(barns.mapArt(0),'');assert(read('style.css').includes('.barn-level.barn-grid-fit'));
assert(read('sw.js').includes('./'+barns.image(3)),'New generated barn must be cached for app updates');
console.log('Grand barn 4×3 foundation corners, vertical walls, seamless projection, silhouette hit area and offline asset passed.');
