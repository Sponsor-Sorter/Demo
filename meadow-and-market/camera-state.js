(() => {
  'use strict';
  function capture(camera,width,viewport){const height=width*2/3;return {zoom:camera.zoom,x:-camera.x/(width*camera.zoom),y:(viewport/2-height/2-camera.y)/(height*camera.zoom)}}
  function restore(saved,width,viewport){if(!saved||![saved.zoom,saved.x,saved.y].every(Number.isFinite)||saved.zoom<1||saved.zoom>2.8||Math.abs(saved.x)>3||Math.abs(saved.y)>3)return null;const height=width*2/3;return {zoom:saved.zoom,x:-saved.x*width*saved.zoom,y:viewport/2-height/2-saved.y*height*saved.zoom}}
  window.meadowCamera={capture,restore};
})();
