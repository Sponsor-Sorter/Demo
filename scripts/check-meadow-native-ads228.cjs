// Execute the real Java plugin against controlled SDK callbacks. This is a
// host contract test, not an assertion that a real network returned No Fill.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'meadow-native-ads228-'));
const files=[];
function source(name,body){const file=path.join(temp,name.replaceAll('.','/')+'.java');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);files.push(file);}
const cap='package com.getcapacitor;';
source('com.getcapacitor.PluginMethod',cap+'public @interface PluginMethod {}');
source('com.getcapacitor.annotation.CapacitorPlugin','package com.getcapacitor.annotation; public @interface CapacitorPlugin {String name();}');
source('com.getcapacitor.JSObject',cap+'public class JSObject extends java.util.HashMap<String,Object> {}');
source('com.getcapacitor.PluginCall',cap+`public class PluginCall {
 public java.util.Map<String,Object> data=new java.util.HashMap<>(); public JSObject result;public String error;public int resolves,rejects;
 public Boolean getBoolean(String k,boolean fallback){return (Boolean)data.getOrDefault(k,fallback);}public String getString(String k){return (String)data.get(k);}
 public void resolve(){resolves++;}public void resolve(JSObject r){result=r;resolves++;}public void reject(String e){error=e;rejects++;}
}`);
source('com.meadowandmarket.game.MeadowPlayPlugin',`package com.meadowandmarket.game; import com.getcapacitor.PluginCall;
public class MeadowPlayPlugin {protected void trustedPage(PluginCall call,Runnable r){r.run();}protected Object getActivity(){return this;}protected Object getContext(){return this;}}`);
source('com.meadowandmarket.game.BuildConfig',`package com.meadowandmarket.game;public class BuildConfig {public static String MEADOW_REWARDED_AD_UNIT="reward-unit",MEADOW_INTERSTITIAL_AD_UNIT="popup-unit";}`);
source('com.google.android.gms.ads.AdError','package com.google.android.gms.ads;public class AdError {}');
source('com.google.android.gms.ads.LoadAdError','package com.google.android.gms.ads;public class LoadAdError {public int code;public LoadAdError(int c){code=c;}}');
source('com.google.android.gms.ads.FullScreenContentCallback','package com.google.android.gms.ads;public class FullScreenContentCallback {public void onAdDismissedFullScreenContent(){} public void onAdFailedToShowFullScreenContent(AdError e){}}');
source('com.google.android.gms.ads.AdRequest','package com.google.android.gms.ads;public class AdRequest {public static class Builder {public AdRequest build(){return new AdRequest();}}}');
source('com.google.android.gms.ads.RequestConfiguration',`package com.google.android.gms.ads;public class RequestConfiguration {
 public static int TAG_FOR_UNDER_AGE_OF_CONSENT_TRUE=1;public static String MAX_AD_CONTENT_RATING_PG="PG";public int underAge;public String rating;
 public static class Builder {RequestConfiguration r=new RequestConfiguration();public Builder setTagForUnderAgeOfConsent(int v){r.underAge=v;return this;}public Builder setMaxAdContentRating(String v){r.rating=v;return this;}public RequestConfiguration build(){return r;}}
}`);
source('com.google.android.gms.ads.MobileAds',`package com.google.android.gms.ads;public class MobileAds {public static RequestConfiguration config;public static int initialized;
 public static void setRequestConfiguration(RequestConfiguration c){config=c;}public static void initialize(Object c,java.util.function.Consumer<Object> cb){initialized++;cb.accept(null);}}`);
source('com.google.android.ump.FormError','package com.google.android.ump;public class FormError {}');
source('com.google.android.ump.ConsentRequestParameters',`package com.google.android.ump;public class ConsentRequestParameters {public boolean underAge;public static class Builder {ConsentRequestParameters p=new ConsentRequestParameters();public Builder setTagForUnderAgeOfConsent(boolean v){p.underAge=v;return this;}public ConsentRequestParameters build(){return p;}}}`);
source('com.google.android.ump.ConsentInformation',`package com.google.android.ump;public class ConsentInformation {
 public boolean allowed=true,fail=false;public ConsentRequestParameters params;public enum PrivacyOptionsRequirementStatus {REQUIRED,NOT_REQUIRED}
 public PrivacyOptionsRequirementStatus requirement=PrivacyOptionsRequirementStatus.NOT_REQUIRED;
 public boolean canRequestAds(){return allowed;}public PrivacyOptionsRequirementStatus getPrivacyOptionsRequirementStatus(){return requirement;}
 public void requestConsentInfoUpdate(Object a,ConsentRequestParameters p,Runnable ok,java.util.function.Consumer<FormError> error){params=p;if(fail)error.accept(new FormError());else ok.run();}
}`);
source('com.google.android.ump.UserMessagingPlatform',`package com.google.android.ump;public class UserMessagingPlatform {public static ConsentInformation info=new ConsentInformation();
 public static ConsentInformation getConsentInformation(Object c){return info;}public static void loadAndShowConsentFormIfRequired(Object a,java.util.function.Consumer<FormError> c){c.accept(null);}public static void showPrivacyOptionsForm(Object a,java.util.function.Consumer<FormError> c){c.accept(null);}}`);
source('com.google.android.gms.ads.rewarded.ServerSideVerificationOptions',`package com.google.android.gms.ads.rewarded;public class ServerSideVerificationOptions {public String user,nonce;public static class Builder {ServerSideVerificationOptions o=new ServerSideVerificationOptions();public Builder setUserId(String v){o.user=v;return this;}public Builder setCustomData(String v){o.nonce=v;return this;}public ServerSideVerificationOptions build(){return o;}}}`);
source('com.google.android.gms.ads.rewarded.RewardedAdLoadCallback','package com.google.android.gms.ads.rewarded;import com.google.android.gms.ads.LoadAdError;public class RewardedAdLoadCallback {public void onAdFailedToLoad(LoadAdError e){}public void onAdLoaded(RewardedAd a){}}');
source('com.google.android.gms.ads.rewarded.RewardedAd',`package com.google.android.gms.ads.rewarded;import com.google.android.gms.ads.*;
public class RewardedAd {public static RewardedAdLoadCallback pending;public static int loads;public static String lastUnit;public FullScreenContentCallback callback;public java.util.function.Consumer<Object> reward;public ServerSideVerificationOptions ssv;
 public static void load(Object c,String unit,AdRequest r,RewardedAdLoadCallback cb){loads++;lastUnit=unit;pending=cb;}public void setServerSideVerificationOptions(ServerSideVerificationOptions o){ssv=o;}public void setFullScreenContentCallback(FullScreenContentCallback c){callback=c;}public void show(Object a,java.util.function.Consumer<Object> r){reward=r;}}
`);
source('com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback','package com.google.android.gms.ads.interstitial;import com.google.android.gms.ads.LoadAdError;public class InterstitialAdLoadCallback {public void onAdFailedToLoad(LoadAdError e){}public void onAdLoaded(InterstitialAd a){}}');
source('com.google.android.gms.ads.interstitial.InterstitialAd',`package com.google.android.gms.ads.interstitial;import com.google.android.gms.ads.*;public class InterstitialAd {public static InterstitialAdLoadCallback pending;public static String lastUnit;public FullScreenContentCallback callback;public static void load(Object c,String u,AdRequest r,InterstitialAdLoadCallback cb){lastUnit=u;pending=cb;}public void setFullScreenContentCallback(FullScreenContentCallback c){callback=c;}public void show(Object a){}}`);
source('com.meadowandmarket.game.AdContract228',`package com.meadowandmarket.game;
import com.getcapacitor.*;import com.google.android.gms.ads.*;import com.google.android.gms.ads.rewarded.*;import com.google.android.gms.ads.interstitial.*;import com.google.android.ump.*;
public class AdContract228 {
 static void check(boolean v,String m){if(!v)throw new AssertionError(m);}static PluginCall rewarded(){PluginCall c=new PluginCall();c.data.put("rewarded",true);c.data.put("nonce","00000000-0000-4000-8000-000000000228");c.data.put("accountId","a".repeat(64));return c;}
 static MeadowAdsPlugin ready(){UserMessagingPlatform.info=new ConsentInformation();MeadowAdsPlugin p=new MeadowAdsPlugin();PluginCall c=new PluginCall();p.consent(c);check(c.resolves==1&&Boolean.TRUE.equals(c.result.get("canRequestAds")),"consent ready");check(UserMessagingPlatform.info.params.underAge,"UMP restricted age");check(MobileAds.config.underAge==1&&"PG".equals(MobileAds.config.rating),"restricted PG requests");return p;}
 public static void main(String[] args){
  MeadowAdsPlugin p=new MeadowAdsPlugin();PluginCall c=rewarded();p.show(c);check(c.rejects==1,"show before consent rejected");
  p=ready();UserMessagingPlatform.info.allowed=false;c=rewarded();p.show(c);check(c.rejects==1,"no consent cannot load");
  p=ready();c=rewarded();c.data.put("nonce","bad");int loads=RewardedAd.loads;p.show(c);check(c.rejects==1&&loads==RewardedAd.loads,"invalid nonce cannot load");
  p=ready();c=rewarded();p.show(c);PluginCall busy=rewarded();p.show(busy);check(busy.rejects==1,"concurrent ad rejected");RewardedAd.pending.onAdFailedToLoad(new LoadAdError(3));check(c.rejects==1&&c.resolves==0,"No Fill never rewards");
  PluginCall retry=rewarded();p.show(retry);RewardedAd ad=new RewardedAd();RewardedAd.pending.onAdLoaded(ad);check(ad.ssv.nonce.equals(retry.data.get("nonce"))&&ad.ssv.user.equals(retry.data.get("accountId")),"SSV bound to exact owner and nonce");ad.callback.onAdDismissedFullScreenContent();check(retry.resolves==1&&Boolean.FALSE.equals(retry.result.get("earned"))&&Boolean.FALSE.equals(retry.result.get("verificationPending")),"early dismissal is unearned and load failure released busy");
  c=rewarded();p.show(c);ad=new RewardedAd();RewardedAd.pending.onAdLoaded(ad);ad.reward.accept(null);ad.callback.onAdDismissedFullScreenContent();check(Boolean.TRUE.equals(c.result.get("earned"))&&Boolean.TRUE.equals(c.result.get("verificationPending")),"earned requires independent verification");check(c.result.size()==2,"native completion cannot mint currency");
  c=rewarded();p.show(c);ad=new RewardedAd();RewardedAd.pending.onAdLoaded(ad);ad.callback.onAdFailedToShowFullScreenContent(new AdError());check(c.rejects==1&&c.resolves==0,"show failure cannot reward");
  c=new PluginCall();p.show(c);InterstitialAd popup=new InterstitialAd();InterstitialAd.pending.onAdLoaded(popup);popup.callback.onAdDismissedFullScreenContent();check(Boolean.FALSE.equals(c.result.get("earned")),"popup has no reward");
  p=ready();UserMessagingPlatform.info.fail=true;c=new PluginCall();p.consent(c);check(c.rejects==1,"privacy update failure is explained");
  p=ready();c=new PluginCall();p.capabilities(c);check(Boolean.TRUE.equals(c.result.get("isolatedTestAds")),"isolated capability advertised");
  c=new PluginCall();c.data.put("rewarded",true);c.data.put("testOnly",true);p.show(c);check("ca-app-pub-3940256099942544/5224354917".equals(RewardedAd.lastUnit),"acceptance uses only Google demo rewarded unit");ad=new RewardedAd();RewardedAd.pending.onAdLoaded(ad);check(ad.ssv==null,"demo never carries player identity or server reward nonce");ad.reward.accept(null);ad.callback.onAdDismissedFullScreenContent();check(Boolean.TRUE.equals(c.result.get("testOnly"))&&Boolean.FALSE.equals(c.result.get("verificationPending")),"demo completion is not pending gameplay credit");
  c=new PluginCall();c.data.put("testOnly",true);p.show(c);check("ca-app-pub-3940256099942544/1033173712".equals(InterstitialAd.lastUnit),"acceptance uses only Google demo interstitial unit");popup=new InterstitialAd();InterstitialAd.pending.onAdLoaded(popup);popup.callback.onAdDismissedFullScreenContent();check(Boolean.TRUE.equals(c.result.get("testOnly")),"demo popup is labelled");
  System.out.println("Real MeadowAdsPlugin Java callback contracts passed: consent/age/PG, bad nonce, concurrency, No Fill/retry, early dismissal, bound SSV, earned-but-unverified, show failure and nonrewarded popup.");
 }
}`);
const plugin=path.join(temp,'com/meadowandmarket/game/MeadowAdsPlugin.java');fs.copyFileSync(path.join(__dirname,'../tools/meadow-android/android/app/src/play/java/com/meadowandmarket/game/MeadowAdsPlugin.java'),plugin);files.push(plugin);
const homes=[process.env.JAVA_HOME,'C:/Program Files/Android/Android Studio/jbr'].filter(Boolean),home=homes.find(h=>fs.existsSync(path.join(h,'bin',process.platform==='win32'?'javac.exe':'javac')));
const executable=name=>home?path.join(home,'bin',name+(process.platform==='win32'?'.exe':'')):name;
try{cp.execFileSync(executable('javac'),['-encoding','UTF-8','-d',temp,...files],{stdio:'inherit',windowsHide:true});cp.execFileSync(executable('java'),['-cp',temp,'com.meadowandmarket.game.AdContract228'],{stdio:'inherit',windowsHide:true});}
finally{const resolved=path.resolve(temp);if(path.dirname(resolved)!==path.resolve(os.tmpdir())||!path.basename(resolved).startsWith('meadow-native-ads228-'))throw Error('Unsafe temporary cleanup');fs.rmSync(resolved,{recursive:true,force:true});}
