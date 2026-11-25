'use strict';
// Compile the actual bridge guard. Queue UI work so lifecycle changes happen
// between a plugin call and its execution, as they do during close/reopen.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../../..');
const out=fs.mkdtempSync(path.join(os.tmpdir(),'littles-trusted-lifecycle-'));
const files={
 'android/app/Activity.java':`package android.app; public class Activity { public boolean finishing,destroyed; public Runnable pending; public void runOnUiThread(Runnable r){pending=r;} public boolean isFinishing(){return finishing;} public boolean isDestroyed(){return destroyed;} public void flush(){Runnable r=pending;pending=null;r.run();}}`,
 'android/webkit/WebView.java':`package android.webkit; public class WebView { public boolean attached=true,unavailable; public String url="https://sponsorsorter.com/meadow-market-littles/"; public boolean isAttachedToWindow(){return attached;} public String getUrl(){if(!attached)throw new AssertionError("Detached WebView must not be read");if(unavailable)throw new IllegalStateException("Destroyed WebView");return url;}}`,
 'android/net/Uri.java':`package android.net; public class Uri { private final java.net.URI uri; private Uri(String s){uri=java.net.URI.create(s);} public static Uri parse(String s){if(s==null)throw new NullPointerException("uriString");return new Uri(s);} public String getPath(){return uri.getPath();} public String getScheme(){return uri.getScheme();} public String getHost(){return uri.getHost();}}`,
 'com/getcapacitor/Bridge.java':`package com.getcapacitor; public class Bridge { public android.webkit.WebView webView=new android.webkit.WebView(); public android.webkit.WebView getWebView(){return webView;}}`,
 'com/getcapacitor/Plugin.java':`package com.getcapacitor; public class Plugin { public android.app.Activity activity=new android.app.Activity(); public Bridge bridge=new Bridge(); public android.app.Activity getActivity(){return activity;} public Bridge getBridge(){return bridge;}}`,
 'com/getcapacitor/PluginCall.java':`package com.getcapacitor; public class PluginCall { public int rejections; public void reject(String message){rejections++;}}`,
 'com/meadowmarket/littles/LittlesPlayPlugin.java':fs.readFileSync(path.join(root,'tools/meadow-littles-android/android/app/src/main/java/com/meadowmarket/littles/LittlesPlayPlugin.java'),'utf8'),
 'com/meadowmarket/littles/TrustedLifecycleHarness.java':`package com.meadowmarket.littles;
import android.app.Activity; import com.getcapacitor.PluginCall;
public class TrustedLifecycleHarness extends LittlesPlayPlugin {
 int actions; void check(PluginCall c,boolean allowed){if(actions!=(allowed?1:0)||c.rejections!=(allowed?0:1))throw new AssertionError("Must run exactly once or reject once");}
 interface Change {void apply(TrustedLifecycleHarness p);}
 static void test(String name,Change change,boolean allowed){TrustedLifecycleHarness p=new TrustedLifecycleHarness();PluginCall c=new PluginCall();Activity a=p.activity;p.trusted(c,()->p.actions++);if(p.actions!=0)throw new AssertionError("Trust check must execute on UI thread");change.apply(p);a.flush();p.check(c,allowed);System.out.println("PASS "+name);}
 public static void main(String[] args){
  TrustedLifecycleHarness absent=new TrustedLifecycleHarness();absent.activity=null;PluginCall c=new PluginCall();absent.trusted(c,()->absent.actions++);absent.check(c,false);System.out.println("PASS absent activity");
  test("trusted live game",p->{},true);
  test("trusted game document",p->p.bridge.webView.url="https://sponsorsorter.com/meadow-market-littles/index.html?release=98",true);
  test("activity replaced before UI callback",p->p.activity=new Activity(),false);
  test("activity finishing",p->p.activity.finishing=true,false);
  test("activity destroyed",p->p.activity.destroyed=true,false);
  test("bridge not initialized",p->p.bridge=null,false);
  test("WebView not initialized",p->p.bridge.webView=null,false);
  test("WebView detached or destroyed",p->p.bridge.webView.attached=false,false);
  test("WebView getter unavailable",p->p.bridge.webView.unavailable=true,false);
  test("null URL on startup or teardown",p->p.bridge.webView.url=null,false);
  test("empty URL",p->p.bridge.webView.url="",false);
  test("URL checked at callback time",p->p.bridge.webView.url="https://evil.example/meadow-market-littles/",false);
  test("HTTP origin rejected",p->p.bridge.webView.url="http://sponsorsorter.com/meadow-market-littles/",false);
  test("lookalike host rejected",p->p.bridge.webView.url="https://sponsorsorter.com.evil.example/meadow-market-littles/",false);
  test("other game path rejected",p->p.bridge.webView.url="https://sponsorsorter.com/meadow-and-market/",false);
  test("path prefix lookalike rejected",p->p.bridge.webView.url="https://sponsorsorter.com/meadow-market-littles-evil/",false);
  test("local URL rejected",p->p.bridge.webView.url="file:///android_asset/public/index.html",false);
 }
}`
};
for(const [name,body] of Object.entries(files)){const dest=path.join(out,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,body);}
let javaHome=process.env.JAVA_HOME;
if(process.platform==='win32'&&fs.existsSync('C:/Program Files/Android/Android Studio/jbr/bin/javac.exe'))javaHome='C:/Program Files/Android/Android Studio/jbr';
for(const [exe,args] of [['javac',['-encoding','UTF-8','-d',out,...Object.keys(files)]],['java',['-cp',out,'com.meadowmarket.littles.TrustedLifecycleHarness']]]){
 const bin=javaHome?path.join(javaHome,'bin',exe+(process.platform==='win32'?'.exe':'')):exe;
 const r=cp.spawnSync(bin,args,{cwd:out,encoding:'utf8',windowsHide:true,timeout:30000});
 if(r.error)throw r.error;process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');if(r.status!==0){process.exitCode=r.status||1;break;}
}
