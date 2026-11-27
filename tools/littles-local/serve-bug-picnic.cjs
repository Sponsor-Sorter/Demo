'use strict';
require('./qa-network.cjs');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../meadow-market-littles'),fixture=path.join(__dirname,'bug-picnic-qa.html'),layouts=path.join(__dirname,'bug-picnic-layouts.html'),inputs=path.join(__dirname,'bug-input100-qa.html'),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.mp3':'audio/mpeg','.woff2':'font/woff2','.woff':'font/woff','.webmanifest':'application/manifest+json'};
http.createServer((req,res)=>{
 // Every response, including errors and the full app entry, forbids remote auth,
 // realtime and form requests. A fresh QA profile cannot provision a live guest.
 res.setHeader('Content-Security-Policy',"connect-src 'self'; form-action 'self'");
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 try{
  const url=new URL(req.url,'http://127.0.0.1'),name=decodeURIComponent(url.pathname);
  const network=path.join(__dirname,'qa-network.html');
  const file=name==='/qa/network-isolation'?network:name==='/qa/bug-picnic'?fixture:name==='/qa/bug-picnic-layouts'?layouts:name==='/qa/bug-input100'?inputs:path.resolve(root,'.'+name+(name.endsWith('/')?'index.html':''));
  if(file!==network&&file!==fixture&&file!==layouts&&file!==inputs&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
  res.writeHead(200);fs.createReadStream(file).pipe(res);
 }catch{res.writeHead(400).end();}
}).listen(4399,'127.0.0.1',()=>console.log('Bug Smash local QA: http://127.0.0.1:4399/qa/bug-picnic'));
