package com.meadowmarket.littles;

import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.*;
import com.google.android.gms.ads.rewarded.ServerSideVerificationOptions;
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAd;
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAdLoadCallback;
import com.google.android.ump.*;
import java.util.UUID;

/** One labelled home-screen banner, with child-directed requests and no AD_ID permission. */
@CapacitorPlugin(name="LittlesAds")
public class LittlesAdsPlugin extends LittlesPlayPlugin {
    private ConsentInformation consent;
    private boolean adsInitialized=false;
    private LinearLayout panel;
    private AdView banner;
    private int generation=0;
    private int rewardGeneration=0;
    private PluginCall rewardCall;
    private RewardedInterstitialAd rewardAd;
    private boolean rewardShowing=false,rewardEarned=false;
    private AdLifecycle rewardTrace;
    private int rewardDiagnosticSequence=0;
    private final Handler rewardTimer=new Handler(Looper.getMainLooper());
    private final View.OnLayoutChangeListener resize=(view,left,top,right,bottom,oldLeft,oldTop,oldRight,oldBottom)->{
        if(panel!=null && right-left!=oldRight-oldLeft)hide();
    };
    @Override public void load(){getBridge().getWebView().addOnLayoutChangeListener(resize);}
    @PluginMethod public void consent(PluginCall call){trusted(call,()->{
        // Set before SDK initialization or the first ad request. No mediation SDKs.
        MobileAds.setRequestConfiguration(new RequestConfiguration.Builder()
            .setAgeRestrictedTreatment(AgeRestrictedTreatment.CHILD)
            .setTagForChildDirectedTreatment(RequestConfiguration.TAG_FOR_CHILD_DIRECTED_TREATMENT_TRUE)
            .setTagForUnderAgeOfConsent(RequestConfiguration.TAG_FOR_UNDER_AGE_OF_CONSENT_TRUE)
            .setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_G).build());
        consent=UserMessagingPlatform.getConsentInformation(getContext());
        ConsentRequestParameters params=new ConsentRequestParameters.Builder().setTagForUnderAgeOfConsent(true).build();
        consent.requestConsentInfoUpdate(getActivity(),params,
            ()->UserMessagingPlatform.loadAndShowConsentFormIfRequired(getActivity(),error->resolveConsent(call,"form",error)),
            error->resolveConsent(call,"update",error));
    });}
    private void resolveConsent(PluginCall call,String stage,FormError error){
        // UMP may still permit ads using valid prior-session consent after a refresh error.
        // Always use the SDK's current decision; never infer consent from success or failure.
        boolean allowed=consent.canRequestAds();
        JSObject value=new JSObject();value.put("canRequestAds",allowed);
        value.put("privacyOptionsRequired",consent.getPrivacyOptionsRequirementStatus()==ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED);
        value.put("consentErrorStage",error==null?"none":stage);
        value.put("consentErrorCode",error==null?0:error.getErrorCode());
        if(allowed&&!adsInitialized){MobileAds.initialize(getContext(),status->{});adsInitialized=true;}
        call.resolve(value);
    }
    private void hide(){boolean existed=panel!=null;generation++;if(banner!=null){banner.destroy();banner=null;}if(panel!=null){ViewGroup parent=(ViewGroup)panel.getParent();if(parent!=null)parent.removeView(panel);panel=null;}if(existed)notifyListeners("bannerHidden",new JSObject());}
    @PluginMethod public void hideBanner(PluginCall call){trusted(call,()->{hide();call.resolve();});}
    @PluginMethod public void showBanner(PluginCall call){trusted(call,()->{
        if(panel!=null){call.resolve();return;}
        if(Boolean.TRUE.equals(call.getBoolean("demoOnly",false))&&!BuildConfig.LITTLES_ADS_DEMO){call.reject("Use the acceptance build for private ad tests.");return;}
        if(consent==null||!consent.canRequestAds()){call.reject("Advertising is not ready.");return;}
        String unit=BuildConfig.LITTLES_ADS_DEMO?"ca-app-pub-3940256099942544/9214589741":BuildConfig.LITTLES_BANNER_AD_UNIT;
        if(unit.isEmpty()){call.reject("No advertisement is configured.");return;}
        int token=++generation;float density=getContext().getResources().getDisplayMetrics().density;
        FrameLayout root=getActivity().findViewById(android.R.id.content);
        TextView label=new TextView(getContext());label.setText("Advertisement");label.setTextColor(Color.rgb(92,105,90));label.setTextSize(12);label.setTypeface(Typeface.DEFAULT,Typeface.BOLD);label.setGravity(Gravity.CENTER);label.setSingleLine(true);
        label.measure(View.MeasureSpec.UNSPECIFIED,View.MeasureSpec.UNSPECIFIED);
        BannerLayout fit=BannerLayout.fit(Math.min(root.getWidth(),getBridge().getWebView().getWidth()),density,label.getMeasuredWidth());
        if(fit==null){call.reject("Not enough room for an advertisement.");return;}
        AdSize size=AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(getContext(),fit.adWidthDp);
        LinearLayout holder=new LinearLayout(getContext());holder.setOrientation(LinearLayout.VERTICAL);holder.setGravity(Gravity.CENTER);
        GradientDrawable surface=new GradientDrawable();surface.setColor(Color.rgb(250,248,242));surface.setStroke(Math.max(1,(int)density),Color.rgb(214,222,208));
        surface.setCornerRadii(new float[]{16*density,16*density,16*density,16*density,0,0,0,0});holder.setBackground(surface);holder.setElevation(6*density);
        holder.setPadding((int)(BannerLayout.HORIZONTAL_INSET_DP*density),(int)(8*density),(int)(BannerLayout.HORIZONTAL_INSET_DP*density),(int)(8*density));
        LinearLayout row=new LinearLayout(getContext());row.setOrientation(fit.inlineLabel?LinearLayout.HORIZONTAL:LinearLayout.VERTICAL);row.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams labelLayout=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,ViewGroup.LayoutParams.WRAP_CONTENT);
        if(fit.inlineLabel)labelLayout.setMarginEnd((int)(BannerLayout.LABEL_GAP_DP*density));else labelLayout.bottomMargin=(int)(6*density);
        row.addView(label,labelLayout);
        AdView ad=new AdView(getContext());ad.setAdSize(size);ad.setAdUnitId(unit);row.addView(ad);holder.addView(row);
        panel=holder;banner=ad;
        ad.setAdListener(new AdListener(){
            @Override public void onAdLoaded(){if(token!=generation||panel!=holder)return;FrameLayout.LayoutParams layout=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT,Gravity.BOTTOM);if(holder.getParent()==null)root.addView(holder,layout);holder.post(()->{if(token!=generation||panel!=holder)return;JSObject result=new JSObject();result.put("height",Math.ceil(holder.getHeight()/density));notifyListeners("bannerVisible",result);});}
            @Override public void onAdFailedToLoad(LoadAdError error){if(token==generation)hide();}
        });
        ad.loadAd(new AdRequest.Builder().build());call.resolve();
    });}
    @PluginMethod public void privacy(PluginCall call){trusted(call,()->UserMessagingPlatform.showPrivacyOptionsForm(getActivity(),error->{if(error==null)call.resolve();else call.reject("No advertising privacy choices are required right now.");}));}
    private String rewardUnit(){return BuildConfig.LITTLES_ADS_DEMO?"ca-app-pub-3940256099942544/5354046379":BuildConfig.LITTLES_REWARDED_AD_UNIT;}
    @PluginMethod public void rewardedCapabilities(PluginCall call){trusted(call,()->{
        // First-party installation nonce only. Never read AAID, Android ID or hardware identifiers.
        android.content.SharedPreferences prefs=getContext().getSharedPreferences("littles-ad-rounds",android.content.Context.MODE_PRIVATE);
        String client=prefs.getString("client",null);
        if(client==null){client=UUID.randomUUID().toString();if(!prefs.edit().putString("client",client).commit()){call.reject("Optional adverts are unavailable.");return;}}
        JSObject result=new JSObject();result.put("contract","littles-ad-round-v1");result.put("package","com.meadowmarket.littles");
        result.put("format","opt_in_skippable_rewarded_interstitial_v1");result.put("unit",rewardUnit());
        result.put("client",client);result.put("demo",BuildConfig.LITTLES_ADS_DEMO);result.put("nativeVersion",BuildConfig.VERSION_CODE);
        result.put("diagnostics",BuildConfig.LITTLES_AD_DIAGNOSTICS);
        call.resolve(result);
    });}
    @PluginMethod public void rewardedDiagnostics(PluginCall call){trusted(call,()->{
        if(!BuildConfig.LITTLES_AD_DIAGNOSTICS){call.reject("Ad diagnostics are unavailable.");return;}
        Integer request=call.getInt("request",0);
        if(request==null||request<1||request>1000000||rewardDiagnosticSequence>=1000000){call.reject("Ad diagnostics are unavailable.");return;}
        JSObject value=new JSObject();value.put("contract","littles-ad-timing-v1");value.put("request",request);value.put("sequence",++rewardDiagnosticSequence);
        value.put("generation",rewardTrace==null?0:rewardTrace.generation());value.put("kind",rewardTrace==null?"none":rewardTrace.kind());
        JSArray events=new JSArray();
        if(rewardTrace!=null){long[] times=rewardTrace.times();for(int i=0;i<times.length;i++)if(times[i]>=0){JSObject event=new JSObject();event.put("code",AdLifecycle.CODES[i]);event.put("ms",times[i]);events.put(event);}value.put("sampledMs",rewardTrace.sampledMs());value.put("terminal",rewardTrace.terminal());}
        else{value.put("sampledMs",0);value.put("terminal",false);}
        value.put("events",events);call.resolve(value);
    });}
    private void finishReward(int token,boolean unavailable){
        if(token!=rewardGeneration||rewardCall==null)return;
        if(rewardTrace!=null)rewardTrace.mark(unavailable?AdLifecycle.UNAVAILABLE:AdLifecycle.DISMISSED);
        PluginCall pending=rewardCall;JSObject result=new JSObject();result.put("closed",true);result.put("earned",rewardEarned);result.put("unavailable",unavailable);
        if(rewardTrace!=null){result.put("diagnosticGeneration",rewardTrace.generation());result.put("diagnosticKind",rewardTrace.kind());}
        rewardGeneration++;rewardCall=null;rewardAd=null;rewardShowing=false;rewardEarned=false;rewardTimer.removeCallbacksAndMessages(null);
        pending.resolve(result);
    }
    @PluginMethod public void showRewarded(PluginCall call){trusted(call,()->{
        String challenge=call.getString("challenge","");
        if(!challenge.matches("^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$")){call.reject("Optional advert is not ready.");return;}
        showRewardedUnit(call,rewardUnit(),challenge);
    });}
    @PluginMethod public void showDiagnosticRewarded(PluginCall call){trusted(call,()->{
        if(!BuildConfig.LITTLES_AD_DIAGNOSTICS){call.reject("Ad diagnostics are unavailable.");return;}
        // Official fixed sample only. No prepare, challenge, custom SSV data, claim or game credit.
        showRewardedUnit(call,"ca-app-pub-3940256099942544/5354046379",null);
    });}
    private void showRewardedUnit(PluginCall call,String unit,String challenge){
        if(rewardCall!=null||consent==null||!consent.canRequestAds()||!unit.matches("^ca-app-pub-[0-9]+/[0-9]+$")||!getActivity().hasWindowFocus()){
            call.reject("Optional adverts are unavailable.");return;
        }
        hide();final int token=++rewardGeneration;rewardCall=call;rewardEarned=false;rewardShowing=false;
        rewardTrace=BuildConfig.LITTLES_AD_DIAGNOSTICS?new AdLifecycle(android.os.SystemClock::elapsedRealtime,token,challenge==null?AdLifecycle.DEMO:AdLifecycle.PUBLISHER):null;
        rewardTimer.postDelayed(()->{if(token==rewardGeneration&&!rewardShowing)finishReward(token,true);},30000);
        try{RewardedInterstitialAd.load(getContext(),unit,new AdRequest.Builder().build(),new RewardedInterstitialAdLoadCallback(){
            @Override public void onAdFailedToLoad(LoadAdError error){finishReward(token,true);}
            @Override public void onAdLoaded(RewardedInterstitialAd ad){
                if(token!=rewardGeneration||rewardCall==null)return;
                if(getActivity()==null||getActivity().isFinishing()||getActivity().isDestroyed()||!getActivity().hasWindowFocus()){
                    finishReward(token,true);return;
                }
                rewardAd=ad;
                // Only the opaque, server-created challenge is shared with Google; no account/name/email.
                if(challenge!=null)ad.setServerSideVerificationOptions(new ServerSideVerificationOptions.Builder().setCustomData(challenge).build());
                ad.setFullScreenContentCallback(new FullScreenContentCallback(){
                    @Override public void onAdShowedFullScreenContent(){if(token==rewardGeneration&&rewardCall!=null){if(rewardTrace!=null)rewardTrace.mark(AdLifecycle.SHOWN);rewardShowing=true;rewardTimer.removeCallbacksAndMessages(null);}}
                    @Override public void onAdImpression(){if(token==rewardGeneration&&rewardCall!=null&&rewardTrace!=null)rewardTrace.mark(AdLifecycle.IMPRESSION);}
                    @Override public void onAdFailedToShowFullScreenContent(AdError error){finishReward(token,true);}
                    @Override public void onAdDismissedFullScreenContent(){finishReward(token,false);}
                });
                // The game calls this only after its explicit opt-in intro; never from a transition timer.
                rewardShowing=true;rewardTimer.removeCallbacksAndMessages(null);
                try{ad.show(getActivity(),reward->{if(token==rewardGeneration&&rewardCall!=null){if(rewardTrace!=null)rewardTrace.mark(AdLifecycle.EARNED);rewardEarned=true;}});}
                catch(RuntimeException error){finishReward(token,true);}
            }
        });}catch(RuntimeException error){finishReward(token,true);}
    }
    @PluginMethod public void cancelRewardedLoad(PluginCall call){trusted(call,()->{
        boolean cancelled=rewardCall!=null&&!rewardShowing;
        if(cancelled){if(rewardTrace!=null)rewardTrace.mark(AdLifecycle.LOAD_CANCELLED);finishReward(rewardGeneration,false);}
        JSObject result=new JSObject();result.put("cancelled",cancelled);call.resolve(result);
    });}
    @Override protected void handleOnPause(){hide();}
    @Override protected void handleOnDestroy(){getBridge().getWebView().removeOnLayoutChangeListener(resize);hide();if(rewardTrace!=null)rewardTrace.mark(AdLifecycle.DESTROYED);rewardGeneration++;rewardCall=null;rewardAd=null;rewardTimer.removeCallbacksAndMessages(null);}
}
