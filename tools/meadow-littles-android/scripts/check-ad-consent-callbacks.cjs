'use strict';
// Compile the actual production consent callbacks, with host-only SDK adapters.
// Android assembly separately checks these same methods against Google's real APIs.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),assert=require('node:assert/strict');
const checkout=process.argv[2]||path.resolve(__dirname,'../../..');
const file=path.join(checkout,'tools/meadow-littles-android/android/app/src/main/java/com/meadowmarket/littles/LittlesAdsPlugin.java');
const src=fs.readFileSync(file,'utf8');
function method(signature,optional=false){const start=src.indexOf(signature);if(start<0){assert(optional,'Missing production method');return '';}const open=src.indexOf('{',start);let depth=0,state='code';for(let i=open;i<src.length;i++){const c=src[i],n=src[i+1];if(state==='line'){if(c==='\n')state='code';continue;}if(state==='block'){if(c==='*'&&n==='/'){state='code';i++;}continue;}if(state==='string'||state==='char'){if(c==='\\'){i++;continue;}if(c===(state==='string'?'"':"'"))state='code';continue;}if(c==='/'&&n==='/'){state='line';i++;continue;}if(c==='/'&&n==='*'){state='block';i++;continue;}if(c==='"'){state='string';continue;}if(c==="'"){state='char';continue;}if(c==='{')depth++;if(c==='}'&&--depth===0)return src.slice(start,i+1);}throw Error('Unclosed method');}
const actual=method('@PluginMethod public void consent(PluginCall call)')+'\n'+method('private void resolveConsent(',true);
const java=String.raw`
import java.util.*;
import java.util.function.*;
public class ConsentHarness {
 private ConsentInformation consent;
 private boolean adsInitialized=false;
 private Object getContext(){return this;}
 private Object getActivity(){return this;}
 private void trusted(PluginCall c,Runnable action){action.run();}
 @interface PluginMethod {}
 static class JSObject extends HashMap<String,Object> {}
 static class PluginCall {JSObject result;String rejected;int resolves;void resolve(JSObject v){result=v;resolves++;}void reject(String s){rejected=s;}}
 static class FormError {int code;FormError(int c){code=c;}int getErrorCode(){return code;}String getMessage(){throw new AssertionError("Raw SDK error text must not be read");}}
 static class RequestConfiguration {
  static final int TAG_FOR_CHILD_DIRECTED_TREATMENT_TRUE=1,TAG_FOR_UNDER_AGE_OF_CONSENT_TRUE=1;static final String MAX_AD_CONTENT_RATING_G="G";
  int child,under;String rating;
  static class Builder {RequestConfiguration v=new RequestConfiguration();Builder setTagForChildDirectedTreatment(int x){v.child=x;return this;}Builder setTagForUnderAgeOfConsent(int x){v.under=x;return this;}Builder setMaxAdContentRating(String x){v.rating=x;return this;}RequestConfiguration build(){return v;}}
 }
 static class ConsentRequestParameters {boolean under;static class Builder {ConsentRequestParameters v=new ConsentRequestParameters();Builder setTagForUnderAgeOfConsent(boolean x){v.under=x;return this;}ConsentRequestParameters build(){return v;}}}
 static class MobileAds {static RequestConfiguration config;static int initialized;static void setRequestConfiguration(RequestConfiguration x){config=x;}static void initialize(Object c,Consumer<Object> callback){check(UserMessagingPlatform.info.allow,"SDK permission required for initialization");initialized++;callback.accept(null);}}
 static class ConsentInformation {
  enum PrivacyOptionsRequirementStatus {REQUIRED,NOT_REQUIRED}
  boolean allow,privacy;Runnable success;Consumer<FormError> failure;int requests;
  boolean canRequestAds(){return allow;}
  PrivacyOptionsRequirementStatus getPrivacyOptionsRequirementStatus(){return privacy?PrivacyOptionsRequirementStatus.REQUIRED:PrivacyOptionsRequirementStatus.NOT_REQUIRED;}
  void requestConsentInfoUpdate(Object activity,ConsentRequestParameters p,Runnable ok,Consumer<FormError> fail){check(MobileAds.config!=null&&MobileAds.config.child==1&&MobileAds.config.under==1&&"G".equals(MobileAds.config.rating)&&p.under,"Child/G settings precede consent and SDK init");success=ok;failure=fail;requests++;}
 }
 static class UserMessagingPlatform {static ConsentInformation info;static Consumer<FormError> form;static int gathers;static ConsentInformation getConsentInformation(Object c){return info;}static void loadAndShowConsentFormIfRequired(Object a,Consumer<FormError> done){form=done;gathers++;}}
 static ConsentHarness fresh(boolean allow){MobileAds.config=null;MobileAds.initialized=0;UserMessagingPlatform.info=new ConsentInformation();UserMessagingPlatform.info.allow=allow;UserMessagingPlatform.form=null;UserMessagingPlatform.gathers=0;return new ConsentHarness();}
 static void check(boolean v,String why){if(!v)throw new AssertionError(why);}
 static void result(PluginCall c,boolean allowed){check(c.rejected==null&&c.resolves==1&&c.result!=null,"Exactly one resolved consent result");check(Boolean.valueOf(allowed).equals(c.result.get("canRequestAds")),"Use actual SDK canRequestAds");}
 static void finishInfo(){UserMessagingPlatform.info.success.run();}
 static void finishForm(FormError error){UserMessagingPlatform.form.accept(error);}
 static void test(String name,Runnable r){try{r.run();System.out.println("PASS "+name);}catch(Throwable e){failures++;System.out.println("FAIL "+name+": "+e.getMessage());}}
 static int failures=0;
 public static void main(String[] args){
  test("fresh permitted consent initializes only after completion",()->{ConsentHarness p=fresh(true);PluginCall c=new PluginCall();p.consent(c);check(MobileAds.initialized==0,"No premature init");finishInfo();finishForm(null);result(c,true);check(MobileAds.initialized==1,"One init");});
  test("update failure retains SDK-approved prior consent",()->{ConsentHarness p=fresh(true);PluginCall c=new PluginCall();p.consent(c);UserMessagingPlatform.info.failure.accept(new FormError(2));result(c,true);check(MobileAds.initialized==1&&UserMessagingPlatform.gathers==0,"Prior approval without another form");check("update".equals(c.result.get("consentErrorStage"))&&Integer.valueOf(2).equals(c.result.get("consentErrorCode")),"Safe error projection");});
  test("form failure retains SDK-approved prior consent",()->{ConsentHarness p=fresh(true);PluginCall c=new PluginCall();p.consent(c);finishInfo();finishForm(new FormError(4));result(c,true);check(MobileAds.initialized==1,"Initialize permitted SDK");check("form".equals(c.result.get("consentErrorStage")),"Form-stage projection");});
  test("update failure with no permission stays unavailable",()->{ConsentHarness p=fresh(false);PluginCall c=new PluginCall();p.consent(c);UserMessagingPlatform.info.failure.accept(new FormError(2));result(c,false);check(MobileAds.initialized==0,"No unauthorized init");});
  test("form failure with no permission stays unavailable",()->{ConsentHarness p=fresh(false);PluginCall c=new PluginCall();p.consent(c);finishInfo();finishForm(new FormError(4));result(c,false);check(MobileAds.initialized==0,"No unauthorized init");});
  test("successful check does not override denied SDK permission",()->{ConsentHarness p=fresh(false);PluginCall c=new PluginCall();p.consent(c);finishInfo();finishForm(null);result(c,false);check(MobileAds.initialized==0,"No unauthorized init");});
  test("later retry recovers without an app restart",()->{ConsentHarness p=fresh(false);PluginCall a=new PluginCall();p.consent(a);UserMessagingPlatform.info.failure.accept(new FormError(2));result(a,false);UserMessagingPlatform.info.allow=true;PluginCall b=new PluginCall();p.consent(b);finishInfo();finishForm(null);result(b,true);check(MobileAds.initialized==1,"One recovered init");});
  test("repeated permitted checks do not reinitialize SDK",()->{ConsentHarness p=fresh(true);PluginCall a=new PluginCall();p.consent(a);finishInfo();finishForm(null);PluginCall b=new PluginCall();p.consent(b);UserMessagingPlatform.info.failure.accept(new FormError(2));result(a,true);result(b,true);check(MobileAds.initialized==1,"SDK init exactly once");});
  test("required privacy entry point is preserved on error",()->{ConsentHarness p=fresh(false);UserMessagingPlatform.info.privacy=true;PluginCall c=new PluginCall();p.consent(c);UserMessagingPlatform.info.failure.accept(new FormError(1));result(c,false);check(Boolean.TRUE.equals(c.result.get("privacyOptionsRequired")),"Keep required privacy choice");});
  if(failures>0)throw new AssertionError(failures+" consent callback cases failed");
 }
 PRODUCTION_METHODS
}
`.replace('PRODUCTION_METHODS',actual);
const out=fs.mkdtempSync(path.join(os.tmpdir(),'littles-consent-callbacks-'));fs.writeFileSync(path.join(out,'ConsentHarness.java'),java);
let javaHome=process.env.JAVA_HOME;if(process.platform==='win32'&&fs.existsSync('C:/Program Files/Android/Android Studio/jbr/bin/javac.exe'))javaHome='C:/Program Files/Android/Android Studio/jbr';
for(const [exe,args]of [['javac',['-encoding','UTF-8','ConsentHarness.java']],['java',['-cp',out,'ConsentHarness']]]){const bin=javaHome?path.join(javaHome,'bin',exe+(process.platform==='win32'?'.exe':'')):exe;const r=cp.spawnSync(bin,args,{cwd:out,encoding:'utf8',windowsHide:true,timeout:30000});if(r.error)throw r.error;process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');if(r.status!==0){process.exitCode=r.status||1;break;}}
