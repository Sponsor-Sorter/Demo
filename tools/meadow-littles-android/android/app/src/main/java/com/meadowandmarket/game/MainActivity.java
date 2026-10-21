package com.meadowmarket.littles;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

public class MainActivity extends BridgeActivity {
    private static final int SAVE_PICTURE = 7301;
    private byte[] pendingPicture;
    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        getBridge().getWebView().addJavascriptInterface(new PictureBridge(), "LittlesPictures");
        enterImmersiveMode();
    }

    public final class PictureBridge {
        @JavascriptInterface
        public void savePng(String data, String requestedName) {
            if (data == null || data.length() > 18000000 || !data.startsWith("data:image/png;base64,")) return;
            runOnUiThread(() -> {
                Uri page = Uri.parse(getBridge().getWebView().getUrl());
                if (!"https".equals(page.getScheme()) || !"sponsorsorter.com".equals(page.getHost())
                        || page.getPath() == null || !page.getPath().startsWith("/meadow-market-littles/")) return;
                try {
                    if (pendingPicture != null) return;
                    byte[] png = Base64.decode(data.substring(22), Base64.DEFAULT);
                    if (png.length < 24 || png.length > 12000000 || png[0] != (byte)137
                            || png[1] != 80 || png[2] != 78 || png[3] != 71) return;
                    ByteBuffer dimensions = ByteBuffer.wrap(png, 16, 8);
                    int width = dimensions.getInt(), height = dimensions.getInt();
                    if (width < 1 || height < 1 || width > 4096 || height > 4096) return;
                    String name = requestedName == null ? "Meadow-Market-Littles.png"
                            : requestedName.replaceAll("[^a-zA-Z0-9._-]", "_");
                    if (name.length() > 100) name = "Meadow-Market-Littles.png";
                    if (!name.endsWith(".png")) name += ".png";
                    pendingPicture = png;
                    Intent picker = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    picker.addCategory(Intent.CATEGORY_OPENABLE);
                    picker.setType("image/png");
                    picker.putExtra(Intent.EXTRA_TITLE, name);
                    startActivityForResult(picker, SAVE_PICTURE);
                } catch (Exception e) {
                    pendingPicture = null;
                    Toast.makeText(MainActivity.this, "Could not save this picture. Please try again.", Toast.LENGTH_LONG).show();
                }
            });
        }
    }

    @Override
    public void onActivityResult(int request, int result, Intent data) {
        if (request != SAVE_PICTURE) { super.onActivityResult(request, result, data); return; }
        final byte[] png = pendingPicture;
        pendingPicture = null;
        if (result != RESULT_OK || data == null || data.getData() == null || png == null) return;
        final Uri destination = data.getData();
        new Thread(() -> {
            try (OutputStream out = getContentResolver().openOutputStream(destination)) {
                if (out == null) throw new IllegalStateException("No destination");
                out.write(png);
                runOnUiThread(() -> Toast.makeText(this, "Picture saved", Toast.LENGTH_SHORT).show());
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(this, "Could not save. Please try again.", Toast.LENGTH_LONG).show());
            }
        }, "littles-picture-save").start();
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
