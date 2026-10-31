const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const source='tools/meadow-android/android/app/src/play/java/com/meadowandmarket/game/';
for(const name of ['MeadowUpdatesPlugin','MeadowStorePlugin','MeadowAdsPlugin']){
 const text=fs.readFileSync(source+name+'.java','utf8');
 assert(text.includes('extends MeadowPlayPlugin'),name+' must use the UI-thread origin guard');
 assert(!text.includes('getWebView()'),name+' must not read the page before the UI dispatch');
 assert(text.includes('trustedPage(call,'),name+' must guard native entry');
}
// Compile the actual guard with a WebView stub that throws off the UI thread.
// This catches the launch failure that source-string/assembly checks missed.
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'meadow-play-thread-'));
function write(file,text){const p=path.join(dir,file);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,text);}
write('com/getcapacitor/Plugin.java',`package com.getcapacitor;
public class Plugin {
 public static boolean ui=false; public static Runnable queued; public static String page; public static boolean activity=true,bridge=true,web=true;
 public Activity getActivity(){return activity?new Activity():null;} public Bridge getBridge(){return bridge?new Bridge():null;}
 public static class Activity {public void runOnUiThread(Runnable r){if(ui)r.run();else queued=r;}}
 public static class Bridge {public WebView getWebView(){return web?new WebView():null;}}
 public static class WebView {public String getUrl(){if(!ui)throw new IllegalStateException("Wrong WebView thread");return page;}}
}`);
write('com/getcapacitor/PluginCall.java','package com.getcapacitor; public class PluginCall {public String error; public void reject(String s){error=s;}}');
write('com/meadowandmarket/game/MeadowPlayPlugin.java',fs.readFileSync(source+'MeadowPlayPlugin.java','utf8'));
write('com/meadowandmarket/game/ThreadCheck.java',`package com.meadowandmarket.game;
import com.getcapacitor.*;
public class ThreadCheck extends MeadowPlayPlugin {
 static int ran; static void check(boolean b){if(!b)throw new AssertionError();}
 static void run(String url,boolean allowed){
  Plugin.ui=false;Plugin.queued=null;Plugin.page=url;PluginCall call=new PluginCall();int before=ran;
  new ThreadCheck().trustedPage(call,()->{check(Plugin.ui);ran++;});
  check(ran==before && Plugin.queued!=null);Plugin.ui=true;Plugin.queued.run();
  check(allowed?ran==before+1 && call.error==null:ran==before && call.error!=null);
 }
 public static void main(String[] args){
  run("https://sponsorsorter.com/meadow-and-market/",true);
  run("https://sponsorsorter.com/meadow-and-market/?release=216",true);
  for(String u:new String[]{null,"http://sponsorsorter.com/meadow-and-market/","https://sponsorsorter.com.evil/meadow-and-market/","https://sponsorsorter.com/meadow-market-littles/","https://sponsorsorter.com/meadow-and-market-evil/","https://sponsorsorter.com/"})run(u,false);
  Plugin.activity=false;PluginCall absent=new PluginCall();new ThreadCheck().trustedPage(absent,()->{throw new AssertionError();});check(absent.error!=null);Plugin.activity=true;
  Plugin.bridge=false;run("https://sponsorsorter.com/meadow-and-market/",false);Plugin.bridge=true;
  Plugin.web=false;run("https://sponsorsorter.com/meadow-and-market/",false);Plugin.web=true;
  Plugin.ui=true;Plugin.page="https://sponsorsorter.com/meadow-and-market/";PluginCall direct=new PluginCall();int before=ran;new ThreadCheck().trustedPage(direct,()->ran++);check(ran==before+1 && direct.error==null);
  System.out.println("Play native guard: queued UI dispatch, trusted-page checks, absent activity/bridge/WebView and already-UI entry passed.");
 }
}`);
const jdk=process.env.JAVA_HOME||(process.platform==='win32'?'C:/Program Files/Android/Android Studio/jbr':null),exe=n=>jdk?path.join(jdk,'bin',n+(process.platform==='win32'?'.exe':'')):n;
execFileSync(exe('javac'),['-d',dir,...['com/getcapacitor/Plugin.java','com/getcapacitor/PluginCall.java','com/meadowandmarket/game/MeadowPlayPlugin.java','com/meadowandmarket/game/ThreadCheck.java'].map(p=>path.join(dir,p))],{stdio:'inherit'});
execFileSync(exe('java'),['-cp',dir,'com.meadowandmarket.game.ThreadCheck'],{stdio:'inherit'});
const resolved=path.resolve(dir),parent=path.resolve(os.tmpdir());assert(path.dirname(resolved)===parent&&path.basename(resolved).startsWith('meadow-play-thread-'));fs.rmSync(resolved,{recursive:true,force:true});
