package com.meadowandmarket.game;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.install.model.UpdateAvailability;

/** The Play distribution never downloads or installs an APK itself. */
@CapacitorPlugin(name="MeadowUpdates")
public class MeadowUpdatesPlugin extends MeadowPlayPlugin {
    @PluginMethod public void check(PluginCall call) {
        trustedPage(call, () -> {
        AppUpdateManagerFactory.create(getContext()).getAppUpdateInfo().addOnSuccessListener(info->{
            JSObject result=new JSObject();result.put("store",true);result.put("canInstall",true);
            result.put("installedVersion",BuildConfig.VERSION_NAME);
            result.put("availableVersion",String.valueOf(info.availableVersionCode()));
            result.put("available",info.updateAvailability()==UpdateAvailability.UPDATE_AVAILABLE);
            call.resolve(result);
        }).addOnFailureListener(e->call.reject("Open Google Play to check app updates"));
        });
    }
    @PluginMethod public void install(PluginCall call) {
        trustedPage(call, () -> {
            try{getActivity().startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("market://details?id="+getContext().getPackageName())));call.resolve(new JSObject());}
            catch(Exception e){call.reject("Google Play is unavailable on this device");}
        });
    }
    @PluginMethod public void allowInstalls(PluginCall call){call.reject("Google Play handles app updates");}
}
