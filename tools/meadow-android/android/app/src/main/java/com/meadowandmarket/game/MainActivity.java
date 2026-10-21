package com.meadowandmarket.game;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        View web = getBridge().getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(web, (view, insets) -> {
            publishSafeArea(insets);
            return insets;
        });
        web.addOnLayoutChangeListener((v,l,t,r,b,ol,ot,oright,ob) -> {
            WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(v);
            if (insets != null) publishSafeArea(insets);
        });
        ViewCompat.requestApplyInsets(web);
        enterImmersiveMode();
    }

    @Override
    public void onResume() {
        super.onResume();
        getWindow().getDecorView().post(this::enterImmersiveMode);
    }

    private void publishSafeArea(WindowInsetsCompat windowInsets) {
        Insets edges = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars()
                | WindowInsetsCompat.Type.displayCutout());
        // Android reports physical pixels; CSS uses density-independent pixels.
        float density = getResources().getDisplayMetrics().density;
        String script = "(()=>{const s=document.documentElement?.style;if(!s)return;"
                + "s.setProperty('--native-safe-top','" + edges.top/density + "px');"
                + "s.setProperty('--native-safe-right','" + edges.right/density + "px');"
                + "s.setProperty('--native-safe-bottom','" + edges.bottom/density + "px');"
                + "s.setProperty('--native-safe-left','" + edges.left/density + "px');})()";
        getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(script, null));
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enterImmersiveMode();
    }

    private void enterImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }
}
