package com.meadowmarket.littles;

import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;

public abstract class LittlesPlayPlugin extends Plugin {
    protected final void trusted(PluginCall call, Runnable action) {
        if (getActivity() == null) { call.reject("Reopen Littles and try again."); return; }
        getActivity().runOnUiThread(() -> {
            if (getBridge() == null || getBridge().getWebView() == null) { call.reject("Game is not ready."); return; }
            Uri page = Uri.parse(getBridge().getWebView().getUrl());
            String path = page.getPath();
            boolean live = "https".equals(page.getScheme()) && "sponsorsorter.com".equals(page.getHost())
                    && path != null && path.startsWith("/meadow-market-littles/");
            if (!live) { call.reject("Unsupported game address."); return; }
            action.run();
        });
    }
}
