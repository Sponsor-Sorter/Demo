package com.meadowandmarket.game;

import java.net.URL;
import java.util.Arrays;

final class MeadowUpdateRules {
    static final long MAX_APK = 64L * 1024 * 1024;
    static boolean trustedURL(URL url) {
        return "https".equals(url.getProtocol()) && "sponsorsorter.com".equals(url.getHost()) && url.getPort() == -1
            && url.getUserInfo() == null && url.getRef() == null
            && url.getPath().matches("/meadow-and-market/(?:native-release\\.json|meadow-and-market(?:-[0-9]+)?\\.apk)");
    }
    static boolean validManifest(String ownPackage,String packageId,String version,String sha,String apk,long code,long bytes) {
        return ownPackage.equals(packageId) && version.matches("[0-9]+\\.[0-9]+\\.[0-9]+(?:-[a-zA-Z0-9.]+)?")
            && sha.matches("[a-f0-9]{64}") && apk.matches("meadow-and-market(?:-[0-9]+)?\\.apk")
            && code > 0 && bytes >= 1024 && bytes <= MAX_APK;
    }
    static boolean validDownload(long expected,long received,String expectedHash,String actualHash) {
        return expected >= 1024 && expected <= MAX_APK && expected == received && expectedHash.equals(actualHash);
    }
    static boolean sameIdentity(String currentPackage,String downloadedPackage,long currentCode,long expectedCode,long downloadedCode,String[] currentCerts,String[] downloadedCerts) {
        return currentPackage.equals(downloadedPackage) && expectedCode > currentCode && expectedCode == downloadedCode
            && currentCerts != null && downloadedCerts != null && currentCerts.length > 0 && Arrays.equals(currentCerts,downloadedCerts);
    }
}
