package com.meadowmarket.littles;

import android.app.Activity;
import android.net.Uri;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;

public abstract class LittlesPlayPlugin extends Plugin {
    protected final void trusted(PluginCall call, Runnable action) {
        Activity activity = getActivity();
        if (activity == null) { call.reject("Reopen Littles and try again."); return; }
        activity.runOnUiThread(() -> {
            if (activity != getActivity() || activity.isFinishing() || activity.isDestroyed()) {
                call.reject("Reopen Littles and try again."); return;
            }
            Bridge bridge = getBridge();
            WebView webView = bridge == null ? null : bridge.getWebView();
            if (webView == null || !webView.isAttachedToWindow()) { call.reject("Game is not ready."); return; }
            String url;
            try { url = webView.getUrl(); }
            catch (IllegalStateException unavailable) { call.reject("Game is not ready."); return; }
            if (url == null || url.isEmpty()) { call.reject("Game is not ready."); return; }
            Uri page = Uri.parse(url);
            String path = page.getPath();
            boolean live = "https".equals(page.getScheme()) && "sponsorsorter.com".equals(page.getHost())
                    && path != null && path.startsWith("/meadow-market-littles/");
            if (!live) { call.reject("Unsupported game address."); return; }
            action.run();
        });
    }
}
