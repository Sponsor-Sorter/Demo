package com.meadowandmarket.game;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

/** The installer always asks the owner; there is no silent-install path. */
@CapacitorPlugin(name = "MeadowUpdates")
public class MeadowUpdatesPlugin extends Plugin {
    private static final String BASE = "https://sponsorsorter.com/meadow-and-market/";
    private static final long MAX_APK = MeadowUpdateRules.MAX_APK;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private int flags() { return Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES; }
    private PackageInfo installed() throws Exception { return getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), flags()); }
    private long code(PackageInfo info) { return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode; }
    private boolean canInstall() { return Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls(); }
    private void trustedPage(PluginCall call, Runnable action) {
        getActivity().runOnUiThread(() -> {
            String page = getBridge().getWebView().getUrl();
            if (page == null || !page.startsWith(BASE)) { call.reject("App updates are restricted to Meadow Markets"); return; }
            action.run();
        });
    }
    private HttpURLConnection connect(String address) throws Exception {
        URL url = new URL(address);
        if (!MeadowUpdateRules.trustedURL(url)) throw new Exception("Untrusted update address");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(15000);connection.setReadTimeout(30000);
        connection.setUseCaches(false);connection.setRequestProperty("Cache-Control", "no-cache");
        if (connection.getResponseCode() != 200) { connection.disconnect();throw new Exception("Update download is unavailable"); }
        return connection;
    }
    private JSONObject manifest() throws Exception {
        HttpURLConnection connection = connect(BASE + "native-release.json?check=" + System.currentTimeMillis());
        try (InputStream in = connection.getInputStream(); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];int n;while ((n = in.read(buffer)) != -1) { if (bytes.size() + n > 16384) throw new Exception("Invalid update manifest");bytes.write(buffer,0,n); }
            JSONObject data = new JSONObject(bytes.toString(StandardCharsets.UTF_8.name()));
            if (!MeadowUpdateRules.validManifest(getContext().getPackageName(),data.getString("packageId"),data.getString("versionName"),data.getString("sha256"),data.getString("apk"),data.getLong("versionCode"),data.getLong("bytes"))) throw new Exception("Invalid update manifest");
            return data;
        } finally { connection.disconnect(); }
    }
    private String hex(byte[] bytes) { StringBuilder out = new StringBuilder();for (byte b : bytes) out.append(String.format("%02x", b & 255));return out.toString(); }
    private String[] certificates(PackageInfo info) throws Exception {
        Signature[] signatures = Build.VERSION.SDK_INT >= 28 && info.signingInfo != null ? info.signingInfo.getApkContentsSigners() : info.signatures;
        if (signatures == null || signatures.length == 0) throw new Exception("Missing app signing certificate");
        String[] result = new String[signatures.length];for (int i=0;i<signatures.length;i++) result[i]=hex(MessageDigest.getInstance("SHA-256").digest(signatures[i].toByteArray()));Arrays.sort(result);return result;
    }
    @PluginMethod public void check(PluginCall call) {
        trustedPage(call, () -> executor.execute(() -> {
            try {
                PackageInfo current = installed();JSONObject data = manifest();JSObject result = new JSObject();
                result.put("installedCode", code(current));result.put("installedVersion", current.versionName);
                result.put("availableCode", data.getLong("versionCode"));result.put("availableVersion",data.getString("versionName"));
                result.put("bytes",data.getLong("bytes"));result.put("available",data.getLong("versionCode") > code(current));result.put("canInstall",canInstall());call.resolve(result);
            } catch (Exception error) { call.reject("Could not check for an Android update. Try again when online."); }
        }));
    }
    @PluginMethod public void allowInstalls(PluginCall call) {
        trustedPage(call, () -> {
            if (Build.VERSION.SDK_INT >= 26 && !canInstall()) getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:"+getContext().getPackageName())));
            call.resolve();
        });
    }
    @PluginMethod public void install(PluginCall call) {
        trustedPage(call, () -> {
            if (!canInstall()) { JSObject result=new JSObject();result.put("permissionRequired",true);call.resolve(result);return; }
            if (!busy.compareAndSet(false,true)) { call.reject("An app update is already downloading");return; }
            executor.execute(() -> {
                File apk=null;
                try {
                    PackageInfo current=installed();JSONObject data=manifest();long expectedCode=data.getLong("versionCode"),expectedBytes=data.getLong("bytes");
                    if (expectedCode <= code(current)) throw new Exception("This app is already current");
                    File directory=new File(getContext().getCacheDir(),"meadow-updates");if (!directory.isDirectory() && !directory.mkdirs()) throw new Exception("Update storage is unavailable");
                    apk=File.createTempFile("meadow-", ".apk",directory);MessageDigest digest=MessageDigest.getInstance("SHA-256");long bytes=0;
                    HttpURLConnection connection=connect(BASE+data.getString("apk")+"?native="+expectedCode);
                    try (InputStream in=connection.getInputStream(); FileOutputStream out=new FileOutputStream(apk)) {
                        byte[] buffer=new byte[32768];int n;while ((n=in.read(buffer)) != -1) { if(Thread.currentThread().isInterrupted())throw new Exception("Update cancelled");bytes+=n;if(bytes>expectedBytes || bytes>MAX_APK)throw new Exception("Unexpected update size");digest.update(buffer,0,n);out.write(buffer,0,n); }
                        out.getFD().sync();
                    } finally { connection.disconnect(); }
                    if (!MeadowUpdateRules.validDownload(expectedBytes,bytes,data.getString("sha256"),hex(digest.digest()))) throw new Exception("Update checksum does not match");
                    PackageInfo archive=getContext().getPackageManager().getPackageArchiveInfo(apk.getAbsolutePath(),flags());
                    if (archive==null || !MeadowUpdateRules.sameIdentity(current.packageName,archive.packageName,code(current),expectedCode,code(archive),certificates(current),certificates(archive))) throw new Exception("Update does not match this signed game");
                    final File verified=apk;
                    getActivity().runOnUiThread(() -> {
                        try {
                            if(getActivity().isFinishing() || getActivity().isDestroyed())throw new Exception("Game closed");
                            Intent intent=new Intent(Intent.ACTION_VIEW).setDataAndType(FileProvider.getUriForFile(getContext(),getContext().getPackageName()+".fileprovider",verified),"application/vnd.android.package-archive");
                            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);getActivity().startActivity(intent);JSObject result=new JSObject();result.put("installerOpened",true);call.resolve(result);
                        } catch (Exception error) { verified.delete();call.reject("Android could not open the verified installer"); }
                        finally { busy.set(false); }
                    });
                } catch (Exception error) { if(apk!=null)apk.delete();busy.set(false);call.reject("The app update could not be verified. Your installed game and farm are unchanged. "+error.getMessage()); }
            });
        });
    }
    @Override protected void handleOnDestroy() { executor.shutdownNow();super.handleOnDestroy(); }
}
