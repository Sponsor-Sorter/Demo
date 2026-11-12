package com.meadowmarket.littles;

import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
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
    private final View.OnLayoutChangeListener resize=(view,left,top,right,bottom,oldLeft,oldTop,oldRight,oldBottom)->{
        if(panel!=null && right-left!=oldRight-oldLeft)hide();
    };
    @Override public void load(){getBridge().getWebView().addOnLayoutChangeListener(resize);}
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
    @Override protected void handleOnPause(){hide();}
    @Override protected void handleOnDestroy(){getBridge().getWebView().removeOnLayoutChangeListener(resize);hide();}
}
