package com.meadowandmarket.game;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.install.model.UpdateAvailability;

/** The Play distribution never downloads or installs an APK itself. */
@CapacitorPlugin(name="MeadowUpdates")
public class MeadowUpdatesPlugin extends Plugin {
    private boolean trusted(PluginCall call) {
        String page=getBridge().getWebView().getUrl();
        if(page==null||!page.startsWith("https://sponsorsorter.com/meadow-and-market/")){call.reject("Game address not supported");return false;}
        return true;
    }
    @PluginMethod public void check(PluginCall call) {
        if(!trusted(call))return;
        AppUpdateManagerFactory.create(getContext()).getAppUpdateInfo().addOnSuccessListener(info->{
            JSObject result=new JSObject();result.put("store",true);result.put("canInstall",true);
            result.put("installedVersion",BuildConfig.VERSION_NAME);
            result.put("availableVersion",String.valueOf(info.availableVersionCode()));
            result.put("available",info.updateAvailability()==UpdateAvailability.UPDATE_AVAILABLE);
            call.resolve(result);
        }).addOnFailureListener(e->call.reject("Open Google Play to check app updates"));
    }
    @PluginMethod public void install(PluginCall call) {
        if(!trusted(call))return;
        getActivity().runOnUiThread(()->{
            try{getActivity().startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("market://details?id="+getContext().getPackageName())));call.resolve(new JSObject());}
            catch(Exception e){call.reject("Google Play is unavailable on this device");}
        });
    }
    @PluginMethod public void allowInstalls(PluginCall call){call.reject("Google Play handles app updates");}
}
