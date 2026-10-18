const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../meadow-and-market'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),scope={window:{addEventListener(){}}};
vm.runInNewContext(read('hit-shapes.js'),scope);
const {shapes,project}=scope.window.meadowHitShapes;
assert.equal(Object.keys(shapes).length,29);
for(const [file,shape] of Object.entries(shapes)){
  assert.equal(shape.sha256,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'assets/generated',file))).digest('hex'),'Regenerate silhouette after changing '+file);
  assert(shape.points.length>3);
  assert(shape.points.every(p=>p.length===2&&p.every(n=>Number.isFinite(n)&&n>=0&&n<=1)));
}
const square={width:100,height:100,points:[[0,0],[1,1]]};
assert.deepEqual(JSON.parse(JSON.stringify(project(square,200,100,'contain'))),[[25,0],[75,100]]);
assert.deepEqual(JSON.parse(JSON.stringify(project(square,100,200,'contain',.5,1))),[[0,50],[100,100]]);
assert(read('game.js').includes('window.meadowHitShapes?.apply(grid)'));
assert(read('style.css').includes('.farm-grid>.farm-object.flowers img{pointer-events:none!important}'));
assert(read('index.html').includes('hit-shapes.js?v=1'));
console.log('29 artwork silhouettes, letterboxed hit projection and neighbouring flower targets passed.');
