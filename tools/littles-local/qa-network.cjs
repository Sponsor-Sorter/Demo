'use strict';
// Test-only preload. Production clients never import this module.
const http=require('node:http'),https=require('node:https'),net=require('node:net');
const {urlToHttpOptions}=require('node:url');
const installed=Symbol.for('littles.qa.localNetworkOnly');
function deny(){throw new Error('LITTLES_QA_NETWORK_BLOCKED: QA may connect only to loopback fixtures. Reuse the retained Samsung/browser account for authorised live checks.');}
function hostAllowed(host){return ['localhost','127.0.0.1','::1','[::1]'].includes(String(host).toLowerCase());}
function assertUrl(input,protocols=['http:','https:']){
 const url=new URL(input instanceof URL?input.href:typeof input==='string'?input:input?.url);
 if(!protocols.includes(url.protocol)||url.username||url.password||!hostAllowed(url.hostname))deny();
 return url;
}
function assertOptions(options){
 if(options.path&&!options.port&&!options.host&&!options.hostname)deny();
 const host=options.hostname||options.host||'localhost';
 if(!hostAllowed(host)||options.lookup||options.createConnection)deny();
}
function requestGuard(original,protocol){return function(...args){
 const first=args[0];let options;
 if(typeof first==='string'||first instanceof URL){const url=assertUrl(first,[protocol]);options={...urlToHttpOptions(url),...(typeof args[1]==='object'?args[1]:{})};}
 else options=first||{};
 assertOptions(options);return Reflect.apply(original,this,args);
};}
if(!globalThis[installed]){
 globalThis[installed]=true;
 const fetchOriginal=globalThis.fetch;
 if(fetchOriginal)globalThis.fetch=async function(input,init={}){
  assertUrl(input);
  // A loopback fixture cannot redirect a test into production.
  return fetchOriginal(input,{...init,redirect:init.redirect==='manual'?'manual':'error'});
 };
 for(const [module,protocol] of [[http,'http:'],[https,'https:']]){
  module.request=requestGuard(module.request,protocol);
  module.get=function(...args){const request=module.request(...args);request.end();return request;};
 }
 const connect=net.Socket.prototype.connect;
 net.Socket.prototype.connect=function(...args){
  const values=Array.isArray(args[0])?args[0]:args;
  const first=values[0];
  if(typeof first==='object')assertOptions(first||{});
  else if(typeof first==='number')assertOptions({port:first,host:typeof values[1]==='string'?values[1]:'localhost'});
  else deny();
  return Reflect.apply(connect,this,args);
 };
 if(globalThis.WebSocket){const Original=globalThis.WebSocket;globalThis.WebSocket=new Proxy(Original,{construct(target,args,newTarget){assertUrl(args[0],['ws:','wss:']);return Reflect.construct(target,args,newTarget);}});}
}
module.exports={assertUrl,hostAllowed};
