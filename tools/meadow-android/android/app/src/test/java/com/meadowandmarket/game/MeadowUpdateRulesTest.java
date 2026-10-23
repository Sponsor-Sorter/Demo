package com.meadowandmarket.game;

import org.junit.Test;
import static org.junit.Assert.*;
import java.net.URL;

public class MeadowUpdateRulesTest {
    private final String hash = new String(new char[64]).replace('\0','a');
    @Test public void trustedAddressesOnly() throws Exception {
        assertTrue(MeadowUpdateRules.trustedURL(new URL("https://sponsorsorter.com/meadow-and-market/native-release.json?check=123")));
        assertTrue(MeadowUpdateRules.trustedURL(new URL("https://sponsorsorter.com/meadow-and-market/meadow-and-market-9.apk")));
        for(String address:new String[]{"http://sponsorsorter.com/meadow-and-market/native-release.json","https://sponsorsorter.com.evil/meadow-and-market/native-release.json","https://evil@sponsorsorter.com/meadow-and-market/native-release.json","https://sponsorsorter.com:444/meadow-and-market/native-release.json","https://sponsorsorter.com/meadow-and-market/../other.apk","https://sponsorsorter.com/other.apk","https://sponsorsorter.com/meadow-and-market/native-release.json#fragment"})assertFalse(address,MeadowUpdateRules.trustedURL(new URL(address)));
    }
    @Test public void manifestBoundsAndIdentity() {
        assertTrue(MeadowUpdateRules.validManifest("game","game","1.6.0",hash,"meadow-and-market.apk",8,4830301));
        assertFalse(MeadowUpdateRules.validManifest("game","other","1.6.0",hash,"meadow-and-market.apk",8,4830301));
        assertFalse(MeadowUpdateRules.validManifest("game","game","<script>",hash,"meadow-and-market.apk",8,4830301));
        assertFalse(MeadowUpdateRules.validManifest("game","game","1.6.0","bad","meadow-and-market.apk",8,4830301));
        assertFalse(MeadowUpdateRules.validManifest("game","game","1.6.0",hash,"../evil.apk",8,4830301));
        for(long bytes:new long[]{-1,0,100,MeadowUpdateRules.MAX_APK+1})assertFalse(MeadowUpdateRules.validManifest("game","game","1.6.0",hash,"meadow-and-market.apk",8,bytes));
        assertFalse(MeadowUpdateRules.validManifest("game","game","1.6.0",hash,"meadow-and-market.apk",0,4830301));
    }
    @Test public void corruptedAndTruncatedDownloadsReject() {
        assertTrue(MeadowUpdateRules.validDownload(2048,2048,hash,hash));
        assertFalse(MeadowUpdateRules.validDownload(2048,2047,hash,hash));
        assertFalse(MeadowUpdateRules.validDownload(2048,2048,hash,"different"));
        assertFalse(MeadowUpdateRules.validDownload(1,1,hash,hash));
    }
    @Test public void packageVersionAndCertificateMustAllMatch() {
        String[] cert={"certificate"};
        assertTrue(MeadowUpdateRules.sameIdentity("game","game",7,8,8,cert,cert));
        assertFalse(MeadowUpdateRules.sameIdentity("game","other",7,8,8,cert,cert));
        assertFalse(MeadowUpdateRules.sameIdentity("game","game",8,8,8,cert,cert));
        assertFalse(MeadowUpdateRules.sameIdentity("game","game",7,8,9,cert,cert));
        assertFalse(MeadowUpdateRules.sameIdentity("game","game",7,8,8,cert,new String[]{"other-certificate"}));
        assertFalse(MeadowUpdateRules.sameIdentity("game","game",7,8,8,new String[0],new String[0]));
    }
}
