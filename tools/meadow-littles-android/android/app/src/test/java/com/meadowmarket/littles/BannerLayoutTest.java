package com.meadowmarket.littles;

import static org.junit.Assert.*;
import org.junit.Test;

public class BannerLayoutTest {
    @Test public void landscapePhoneExcludesNavigationAndKeepsCompactAd() {
        BannerLayout plan = BannerLayout.fit(2988, 3.75f, 360);
        assertNotNull(plan);
        assertTrue(plan.inlineLabel);
        assertEquals(600, plan.adWidthDp);
        assertTrue((plan.adWidthDp + 96 + 12 + 32) * 3.75f <= 2988);
    }
    @Test public void narrowWindowsStackTheLabelAndNeverClipAnAd() {
        BannerLayout plan = BannerLayout.fit(1080, 3, 280);
        assertNotNull(plan);
        assertFalse(plan.inlineLabel);
        assertEquals(328, plan.adWidthDp);
        assertNull(BannerLayout.fit(900, 3, 280));
        assertNull(BannerLayout.fit(0, 3, 280));
    }
    @Test public void tabletAndLargeTextRemainWithinTheAvailableWidth() {
        assertEquals(728, BannerLayout.fit(2732, 2, 192).adWidthDp);
        for (int width = 320; width <= 1800; width += 17) {
            for (int label = 80; label <= 480; label += 40) {
                BannerLayout plan = BannerLayout.fit(width * 2, 2, label * 2);
                if (plan == null) continue;
                int occupied = plan.adWidthDp + 32 + (plan.inlineLabel ? label + 12 : 0);
                assertTrue("Ad and readable label must fit the app window", occupied <= width);
                assertTrue(plan.adWidthDp >= 320 && plan.adWidthDp <= 728);
            }
        }
    }
}
