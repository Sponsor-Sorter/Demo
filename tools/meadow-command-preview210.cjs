// Isolated, loopback-only browser QA. Serves only Meadow Markets public files;
// no other project's code, repository metadata, credentials or filesystem.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../meadow-and-market');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
http.createServer((req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method))throw Error('Read only');
  const url=new URL(req.url,'http://127.0.0.1:8773');if(!url.pathname.startsWith('/meadow-and-market/'))throw Error('Game only');
  const relative=decodeURIComponent(url.pathname.slice('/meadow-and-market/'.length))||'index.html',file=path.resolve(root,relative),type=types[path.extname(file)];
  if(!file.startsWith(root+path.sep)||relative.split(/[\\/]/).some(p=>p.startsWith('.'))||!type)throw Error('Public game files only');
  const stat=fs.statSync(file);if(!stat.isFile())throw Error('Missing file');
  res.writeHead(200,{'Content-Type':type,'Content-Length':stat.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
 }catch{res.writeHead(404);res.end('Game file unavailable');}
}).listen(8773,'127.0.0.1',()=>console.log('Isolated Meadow Markets preview: http://127.0.0.1:8773/meadow-and-market/?qa=commands210'));
