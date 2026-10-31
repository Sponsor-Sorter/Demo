package com.meadowandmarket.game;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;

/** Check the live page on its UI thread before entering a native Play API. */
public abstract class MeadowPlayPlugin extends Plugin {
    protected final void trustedPage(PluginCall call, Runnable action) {
        if (getActivity() == null) {
            call.reject("Game is not ready. Reopen Meadow Markets.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            if (getBridge() == null || getBridge().getWebView() == null) {
                call.reject("Game is not ready. Reopen Meadow Markets.");
                return;
            }
            String page = getBridge().getWebView().getUrl();
            if (page == null || !page.startsWith("https://sponsorsorter.com/meadow-and-market/")) {
                call.reject("Game address not supported");
                return;
            }
            action.run();
        });
    }
}
