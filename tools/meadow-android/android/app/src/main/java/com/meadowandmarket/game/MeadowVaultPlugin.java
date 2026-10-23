package com.meadowandmarket.game;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Account tokens only. Key material is never exported from Android Keystore. */
@CapacitorPlugin(name = "MeadowVault")
public class MeadowVaultPlugin extends Plugin {
    private static final String ALIAS = "meadow_markets_account_v1";
    private boolean allowed(String key) {
        return "meadow-markets-auth-v1".equals(key)
            || "meadow-markets-guest-session".equals(key)
            || "meadow-markets-auth-v1-code-verifier".equals(key)
            || "meadow-markets-auth-v1-user".equals(key);
    }
    private SharedPreferences prefs() {
        return getContext().getSharedPreferences("meadow_auth_vault", Context.MODE_PRIVATE);
    }
    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(ALIAS)) return (SecretKey) store.getKey(ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }
    private void perform(PluginCall call, String operation) {
        getActivity().runOnUiThread(() -> {
            try {
                Uri page = Uri.parse(getBridge().getWebView().getUrl());
                if (!"https".equals(page.getScheme()) || !"sponsorsorter.com".equals(page.getHost())
                    || page.getPath() == null || !page.getPath().startsWith("/meadow-and-market/")) {
                    call.reject("Account storage is restricted to Meadow Markets"); return;
                }
                String id = call.getString("key");
                if (!allowed(id)) { call.reject("Unknown account storage key"); return; }
                JSObject result = new JSObject();
                if ("get".equals(operation)) {
                    String encoded = prefs().getString(id, null);
                    if (encoded != null) {
                        String[] parts = encoded.split(":", -1);
                        if (parts.length != 2) throw new Exception("Invalid envelope");
                        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
                        cipher.updateAAD(id.getBytes(StandardCharsets.UTF_8));
                        result.put("value", new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8));
                    }
                } else if ("set".equals(operation)) {
                    String value = call.getString("value");
                    if (value == null || value.length() > 65536) { call.reject("Invalid account storage value"); return; }
                    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                    cipher.init(Cipher.ENCRYPT_MODE, key());
                    cipher.updateAAD(id.getBytes(StandardCharsets.UTF_8));
                    String envelope = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":"
                        + Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
                    if (!prefs().edit().putString(id, envelope).commit()) throw new Exception("Write failed");
                } else if (!prefs().edit().remove(id).commit()) throw new Exception("Remove failed");
                call.resolve(result);
            } catch (Exception error) {
                // Fail closed: never erase an unreadable account or silently create a new guest.
                call.reject("Could not unlock Meadow account storage. Your farm has not been replaced.");
            }
        });
    }
    @PluginMethod public void get(PluginCall call) { perform(call, "get"); }
    @PluginMethod public void set(PluginCall call) { perform(call, "set"); }
    @PluginMethod public void remove(PluginCall call) { perform(call, "remove"); }
}
