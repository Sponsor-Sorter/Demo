package com.meadowandmarket.game;

import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.*;
import com.google.android.gms.ads.interstitial.*;
import com.google.android.gms.ads.rewarded.*;
import com.google.android.ump.*;

/** Consent first; rewards require the independent AdMob server callback. */
@CapacitorPlugin(name="MeadowAds")
public class MeadowAdsPlugin extends Plugin {
    private ConsentInformation consent;
    private boolean showing=false;
    private boolean trusted(PluginCall call){
        String url=getBridge().getWebView().getUrl();
        if(url==null||!url.startsWith("https://sponsorsorter.com/meadow-and-market/")){call.reject("Game address not supported");return false;}
        return true;
    }
    @PluginMethod public void consent(PluginCall call){
        if(!trusted(call))return;
        getActivity().runOnUiThread(()->{
            consent=UserMessagingPlatform.getConsentInformation(getContext());
            // All ages in our 13+ audience get restricted/nonpersonalised requests.
            ConsentRequestParameters params=new ConsentRequestParameters.Builder().setTagForUnderAgeOfConsent(true).build();
            consent.requestConsentInfoUpdate(getActivity(),params,()->UserMessagingPlatform.loadAndShowConsentFormIfRequired(getActivity(),error->{
                JSObject r=new JSObject();r.put("canRequestAds",consent.canRequestAds());
                r.put("privacyOptionsRequired",consent.getPrivacyOptionsRequirementStatus()==ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED);
                if(consent.canRequestAds()){
                    MobileAds.setRequestConfiguration(new RequestConfiguration.Builder().setTagForUnderAgeOfConsent(RequestConfiguration.TAG_FOR_UNDER_AGE_OF_CONSENT_TRUE).setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_PG).build());
                    MobileAds.initialize(getContext(),status->{});
                }
                call.resolve(r);
            }),error->call.reject("Advertising privacy choices are unavailable; no ad will be shown"));
        });
    }
    @PluginMethod public void privacy(PluginCall call){if(!trusted(call))return;getActivity().runOnUiThread(()->UserMessagingPlatform.showPrivacyOptionsForm(getActivity(),error->{if(error==null)call.resolve();else call.reject("Privacy options are unavailable");}));}
    @PluginMethod public void show(PluginCall call){
        if(!trusted(call))return;
        getActivity().runOnUiThread(()->{
            if(showing||consent==null||!consent.canRequestAds()){call.reject("Advertising is not ready");return;}
            boolean reward=Boolean.TRUE.equals(call.getBoolean("rewarded",false));
            String unit=reward?BuildConfig.MEADOW_REWARDED_AD_UNIT:BuildConfig.MEADOW_INTERSTITIAL_AD_UNIT;
            if(unit.isEmpty()){call.reject("No ad is available");return;}
            String nonce=call.getString("nonce"),account=call.getString("accountId");
            if(reward&&(nonce==null||!nonce.matches("[a-f0-9-]{36}")||account==null||!account.matches("[a-f0-9]{64}"))){call.reject("Start the reward online first");return;}
            showing=true;
            AdRequest request=new AdRequest.Builder().build();
            if(reward)RewardedAd.load(getContext(),unit,request,new RewardedAdLoadCallback(){
                public void onAdFailedToLoad(LoadAdError error){showing=false;call.reject("No ad available. Try later.");}
                public void onAdLoaded(RewardedAd ad){
                    final boolean[] earned={false};
                    ad.setServerSideVerificationOptions(new ServerSideVerificationOptions.Builder().setUserId(account).setCustomData(nonce).build());
                    ad.setFullScreenContentCallback(callback(call,earned));
                    ad.show(getActivity(),item->earned[0]=true);
                }
            });
            else InterstitialAd.load(getContext(),unit,request,new InterstitialAdLoadCallback(){
                public void onAdFailedToLoad(LoadAdError error){showing=false;call.reject("No ad available");}
                public void onAdLoaded(InterstitialAd ad){ad.setFullScreenContentCallback(callback(call,new boolean[]{false}));ad.show(getActivity());}
            });
        });
    }
    private FullScreenContentCallback callback(PluginCall call,boolean[] earned){return new FullScreenContentCallback(){
        public void onAdDismissedFullScreenContent(){showing=false;JSObject r=new JSObject();r.put("earned",earned[0]);r.put("verificationPending",earned[0]);call.resolve(r);}
        public void onAdFailedToShowFullScreenContent(AdError error){showing=false;call.reject("Could not show ad");}
    };}
}
