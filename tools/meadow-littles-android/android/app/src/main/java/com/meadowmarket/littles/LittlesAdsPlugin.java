package com.meadowmarket.littles;

import android.graphics.Color;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.*;
import com.google.android.ump.*;

/** One labelled home-screen banner, with child-directed requests and no AD_ID permission. */
@CapacitorPlugin(name="LittlesAds")
public class LittlesAdsPlugin extends LittlesPlayPlugin {
    private ConsentInformation consent;
    private LinearLayout panel;
    private AdView banner;
    private int generation=0;
    @PluginMethod public void consent(PluginCall call){trusted(call,()->{
        // Set before SDK initialization or the first ad request. No mediation SDKs.
        MobileAds.setRequestConfiguration(new RequestConfiguration.Builder()
            .setTagForChildDirectedTreatment(RequestConfiguration.TAG_FOR_CHILD_DIRECTED_TREATMENT_TRUE)
            .setTagForUnderAgeOfConsent(RequestConfiguration.TAG_FOR_UNDER_AGE_OF_CONSENT_TRUE)
            .setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_G).build());
        consent=UserMessagingPlatform.getConsentInformation(getContext());
        ConsentRequestParameters params=new ConsentRequestParameters.Builder().setTagForUnderAgeOfConsent(true).build();
        consent.requestConsentInfoUpdate(getActivity(),params,()->UserMessagingPlatform.loadAndShowConsentFormIfRequired(getActivity(),error->{
            JSObject value=new JSObject();value.put("canRequestAds",error==null&&consent.canRequestAds());
            value.put("privacyOptionsRequired",consent.getPrivacyOptionsRequirementStatus()==ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED);
            if(error==null&&consent.canRequestAds())MobileAds.initialize(getContext(),status->{});call.resolve(value);
        }),error->call.reject("Advertising is unavailable. Play can continue."));
    });}
    private void hide(){boolean existed=panel!=null;generation++;if(banner!=null){banner.destroy();banner=null;}if(panel!=null){ViewGroup parent=(ViewGroup)panel.getParent();if(parent!=null)parent.removeView(panel);panel=null;}if(existed)notifyListeners("bannerHidden",new JSObject());}
    @PluginMethod public void hideBanner(PluginCall call){trusted(call,()->{hide();call.resolve();});}
    @PluginMethod public void showBanner(PluginCall call){trusted(call,()->{
        if(panel!=null){call.resolve();return;}
        if(Boolean.TRUE.equals(call.getBoolean("demoOnly",false))&&!BuildConfig.LITTLES_ADS_DEMO){call.reject("Use the acceptance build for private ad tests.");return;}
        if(consent==null||!consent.canRequestAds()){call.reject("Advertising is not ready.");return;}
        String unit=BuildConfig.LITTLES_ADS_DEMO?"ca-app-pub-3940256099942544/6300978111":BuildConfig.LITTLES_BANNER_AD_UNIT;
        if(unit.isEmpty()){call.reject("No advertisement is configured.");return;}
        int token=++generation;float density=getContext().getResources().getDisplayMetrics().density;
        int width=(int)(getContext().getResources().getDisplayMetrics().widthPixels/density);
        AdSize size=AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(getContext(),width);
        LinearLayout holder=new LinearLayout(getContext());holder.setOrientation(LinearLayout.VERTICAL);holder.setGravity(Gravity.CENTER);holder.setBackgroundColor(Color.rgb(255,246,223));
        TextView label=new TextView(getContext());label.setText("Advertisement");label.setTextColor(Color.DKGRAY);label.setTextSize(12);label.setGravity(Gravity.CENTER);
        holder.addView(label,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,(int)(24*density)));
        AdView ad=new AdView(getContext());ad.setAdSize(size);ad.setAdUnitId(unit);holder.addView(ad);
        panel=holder;banner=ad;
        ad.setAdListener(new AdListener(){
            @Override public void onAdLoaded(){if(token!=generation||panel!=holder)return;FrameLayout root=getActivity().findViewById(android.R.id.content);FrameLayout.LayoutParams layout=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT,Gravity.BOTTOM);if(holder.getParent()==null)root.addView(holder,layout);JSObject result=new JSObject();result.put("height",size.getHeight()+24);notifyListeners("bannerVisible",result);}
            @Override public void onAdFailedToLoad(LoadAdError error){if(token==generation){hide();notifyListeners("bannerHidden",new JSObject());}}
        });
        ad.loadAd(new AdRequest.Builder().build());call.resolve();
    });}
    @PluginMethod public void privacy(PluginCall call){trusted(call,()->UserMessagingPlatform.showPrivacyOptionsForm(getActivity(),error->{if(error==null)call.resolve();else call.reject("No advertising privacy choices are required right now.");}));}
    @Override protected void handleOnPause(){hide();}
    @Override protected void handleOnDestroy(){hide();}
}
