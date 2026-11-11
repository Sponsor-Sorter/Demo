package com.meadowmarket.littles;

import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import com.android.billingclient.api.*;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Google handles checkout. Only the server can grant or renew Plus. */
@CapacitorPlugin(name="LittlesStore")
public class LittlesStorePlugin extends LittlesPlayPlugin implements PurchasesUpdatedListener {
    private static final String PRODUCT="ml_plus", PLAN="monthly";
    private BillingClient billing;
    private PluginCall checkout;
    private int generation=0;
    private boolean connecting=false;
    @PluginMethod public void capabilities(PluginCall call) { trusted(call, () -> {
        JSObject value=new JSObject();value.put("contract","littles-play-v1");value.put("package",getContext().getPackageName());
        value.put("adsDemo",BuildConfig.LITTLES_ADS_DEMO);call.resolve(value);
    }); }
    private void connect(PluginCall call, Runnable ready) { trusted(call, () -> {
        if (billing == null) billing=BillingClient.newBuilder(getContext()).setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection().build();
        if (billing.isReady()) { ready.run(); return; }
        if (connecting) { call.reject("Google Play is connecting. Try again shortly."); return; }
        connecting=true;AtomicBoolean waiting=new AtomicBoolean(true);Handler handler=new Handler(Looper.getMainLooper());
        Runnable timeout=()->{if(waiting.compareAndSet(true,false)){connecting=false;call.reject("Google Play connection timed out.");}};
        handler.postDelayed(timeout,20000);
        billing.startConnection(new BillingClientStateListener(){
            public void onBillingSetupFinished(BillingResult result){if(!waiting.compareAndSet(true,false))return;handler.removeCallbacks(timeout);connecting=false;
                if(result.getResponseCode()==BillingClient.BillingResponseCode.OK)ready.run();else call.reject("Google Play billing is unavailable.");}
            public void onBillingServiceDisconnected(){}
        });
    }); }
    private interface ProductReady { void run(ProductDetails product, ProductDetails.SubscriptionOfferDetails offer); }
    private void query(PluginCall call, ProductReady ready) {
        QueryProductDetailsParams.Product product=QueryProductDetailsParams.Product.newBuilder().setProductId(PRODUCT).setProductType(BillingClient.ProductType.SUBS).build();
        billing.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(Collections.singletonList(product)).build(),(result,response)->{
            if(result.getResponseCode()==BillingClient.BillingResponseCode.OK)for(ProductDetails item:response.getProductDetailsList()){
                if(!PRODUCT.equals(item.getProductId())||item.getSubscriptionOfferDetails()==null)continue;
                for(ProductDetails.SubscriptionOfferDetails offer:item.getSubscriptionOfferDetails()){
                    List<ProductDetails.PricingPhase> phases=offer.getPricingPhases().getPricingPhaseList();
                    if(PLAN.equals(offer.getBasePlanId())&&offer.getOfferId()==null&&phases.size()==1&&"P1M".equals(phases.get(0).getBillingPeriod())){ready.run(item,offer);return;}
                }
            }
            call.reject("The monthly plan is not available from Google Play yet.");
        });
    }
    @PluginMethod public void products(PluginCall call) { connect(call,()->query(call,(product,offer)->{
        ProductDetails.PricingPhase price=offer.getPricingPhases().getPricingPhaseList().get(0);JSObject result=new JSObject();
        result.put("id",PRODUCT);result.put("basePlan",PLAN);result.put("price",price.getFormattedPrice());result.put("currency",price.getPriceCurrencyCode());result.put("period","P1M");call.resolve(result);
    })); }
    @PluginMethod public void purchase(PluginCall call) { connect(call,()->{
        if(checkout!=null){call.reject("Finish the current Google Play purchase first.");return;}
        String account=call.getString("accountId");
        if(account==null||!account.matches("[a-f0-9]{64}")){call.reject("Sign in to a grown-up account first.");return;}
        final int intent=++generation;
        query(call,(product,offer)->{
            if(intent!=generation){call.reject("Checkout was closed.");return;}
            checkout=call;
            BillingFlowParams.ProductDetailsParams line=BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product).setOfferToken(offer.getOfferToken()).build();
            BillingResult launched=billing.launchBillingFlow(getActivity(),BillingFlowParams.newBuilder().setObfuscatedAccountId(account).setProductDetailsParamsList(Collections.singletonList(line)).build());
            if(launched.getResponseCode()!=BillingClient.BillingResponseCode.OK){checkout=null;call.reject("Google Play could not open checkout. Use Restore purchases to check an earlier order.");}
        });
    }); }
    private JSArray purchases(List<Purchase> rows){JSArray result=new JSArray();for(Purchase p:rows)if(p.getProducts().contains(PRODUCT)){JSObject item=new JSObject();item.put("token",p.getPurchaseToken());item.put("pending",p.getPurchaseState()!=Purchase.PurchaseState.PURCHASED);result.put(item);}return result;}
    @Override public void onPurchasesUpdated(BillingResult result,List<Purchase> rows){
        PluginCall pending=checkout;checkout=null;JSObject value=new JSObject();
        if(result.getResponseCode()==BillingClient.BillingResponseCode.USER_CANCELED){value.put("cancelled",true);if(pending!=null)pending.resolve(value);return;}
        if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK||rows==null){if(pending!=null)pending.reject("Purchase unfinished. Restore purchases will check it without charging again.");return;}
        value.put("purchases",purchases(rows));if(pending!=null)pending.resolve(value);else notifyListeners("purchasesUpdated",value,true);
    }
    @PluginMethod public void restore(PluginCall call){connect(call,()->billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),(result,rows)->{
        if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK){call.reject("Google Play purchases are unavailable.");return;}JSObject value=new JSObject();value.put("purchases",purchases(rows));call.resolve(value);
    }));}
    @PluginMethod public void cancelCheckout(PluginCall call){trusted(call,()->{generation++;call.resolve();});}
    @PluginMethod public void manage(PluginCall call){trusted(call,()->{
        Intent intent=new Intent(Intent.ACTION_VIEW,Uri.parse("https://play.google.com/store/account/subscriptions?sku="+PRODUCT+"&package=com.meadowmarket.littles"));
        try{getActivity().startActivity(intent);call.resolve();}catch(Exception e){call.reject("Open Google Play, then Payments and subscriptions.");}
    });}
    @Override protected void handleOnDestroy(){generation++;if(billing!=null)billing.endConnection();}
}
