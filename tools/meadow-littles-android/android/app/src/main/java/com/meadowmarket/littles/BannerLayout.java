package com.meadowmarket.littles;

/** Ad sizing uses the app's drawable width, excluding system navigation. */
final class BannerLayout {
    static final int HORIZONTAL_INSET_DP = 16;
    static final int LABEL_GAP_DP = 12;
    final int adWidthDp;
    final boolean inlineLabel;

    private BannerLayout(int adWidthDp, boolean inlineLabel) {
        this.adWidthDp = adWidthDp;
        this.inlineLabel = inlineLabel;
    }

    static BannerLayout fit(int contentWidthPx, float density, int labelWidthPx) {
        if (contentWidthPx <= 0 || !Float.isFinite(density) || density <= 0) return null;
        int widthDp = (int)Math.floor(contentWidthPx / density);
        int labelDp = (int)Math.ceil(Math.max(0, labelWidthPx) / density);
        int available = widthDp - 2 * HORIZONTAL_INSET_DP;
        boolean inline = widthDp >= 680 && available - labelDp - LABEL_GAP_DP >= 320;
        if (inline) available -= labelDp + LABEL_GAP_DP;
        int width = Math.min(widthDp >= 1000 ? 728 : 600, available);
        return width >= 320 ? new BannerLayout(width, inline) : null;
    }
}
