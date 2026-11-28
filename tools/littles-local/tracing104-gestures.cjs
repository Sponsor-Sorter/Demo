'use strict';
const assert=require('node:assert/strict');
// Four small, rounded finger wobbles leave four guide samples unpainted.
// This yields 28/32 coverage while preserving both ends and every quarter.
function gappedStroke(stroke){
 const points=stroke.points;assert.equal(points.length,32);assert(points.every(p=>Math.abs(p.x-points[0].x)<1e-8));
 const x=points[0].x,r=.09,path=[{...points[0]}];
 for(const i of [4,12,20,27]){const y=points[i].y;for(let step=0;step<=16;step++){const angle=-Math.PI/2+step*Math.PI/16;path.push({x:x+r*Math.cos(angle),y:y+r*Math.sin(angle)});}}
 path.push({...points.at(-1)});return path;
}
module.exports={gappedStroke};
