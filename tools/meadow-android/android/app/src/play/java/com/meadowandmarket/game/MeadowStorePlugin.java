package com.meadowandmarket.game;

import com.android.billingclient.api.*;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.*;
import android.os.Handler;
import android.os.Looper;
import java.util.concurrent.atomic.AtomicBoolean;

/** Native store UI only. Entitlements are always verified/delivered by our server. */
@CapacitorPlugin(name="MeadowStore")
public class MeadowStorePlugin extends Plugin implements PurchasesUpdatedListener {
    private BillingClient billing;
    private final Map<String,ProductDetails> catalog=new HashMap<>();
    private final Set<String> allowed=new HashSet<>(Arrays.asList("mm_pocket_gems","mm_gem_chest","mm_starter_pack","mm_builders_pack","mm_reward_tickets","mm_pantry_pack","mm_premium"));
    private PluginCall purchaseCall;
    private boolean trusted(PluginCall call){
        String url=getBridge().getWebView().getUrl();
        if(url==null||!url.startsWith("https://sponsorsorter.com/meadow-and-market/")){call.reject("Purchases are limited to Meadow Markets");return false;}
        return true;
    }
    private void connect(PluginCall call,Runnable action){
        if(!trusted(call))return;
        getActivity().runOnUiThread(()->{
            if(billing==null)billing=BillingClient.newBuilder(getContext()).setListener(this)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection().build();
            if(billing.isReady()){action.run();return;}
            AtomicBoolean pending=new AtomicBoolean(true);
            Handler handler=new Handler(Looper.getMainLooper());
            Runnable timeout=()->{if(pending.compareAndSet(true,false))call.reject("Google Play connection timed out. Try again.");};
            handler.postDelayed(timeout,20000);
            billing.startConnection(new BillingClientStateListener(){
                public void onBillingSetupFinished(BillingResult result){if(!pending.compareAndSet(true,false))return;handler.removeCallbacks(timeout);if(result.getResponseCode()==BillingClient.BillingResponseCode.OK)action.run();else call.reject("Google Play billing is unavailable");}
                public void onBillingServiceDisconnected(){}
            });
        });
    }
    private JSArray purchases(List<Purchase> rows){
        JSArray list=new JSArray();
        for(Purchase p:rows){JSObject o=new JSObject();o.put("token",p.getPurchaseToken());o.put("products",new JSArray(p.getProducts()));o.put("pending",p.getPurchaseState()!=Purchase.PurchaseState.PURCHASED);list.put(o);}
        return list;
    }
    @PluginMethod public void products(PluginCall call){connect(call,()->{
        List<QueryProductDetailsParams.Product> products=new ArrayList<>();
        for(String id:allowed)products.add(QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(BillingClient.ProductType.INAPP).build());
        billing.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(products).build(),(result,response)->{
            if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK){call.reject("Could not load Google Play prices");return;}
            catalog.clear();JSArray rows=new JSArray();
            for(ProductDetails p:response.getProductDetailsList()){
                ProductDetails.OneTimePurchaseOfferDetails offer=p.getOneTimePurchaseOfferDetails();if(offer==null)continue;
                catalog.put(p.getProductId(),p);JSObject o=new JSObject();o.put("id",p.getProductId());o.put("price",offer.getFormattedPrice());o.put("title",p.getName());rows.put(o);
            }
            JSObject answer=new JSObject();answer.put("products",rows);call.resolve(answer);
        });
    });}
    @PluginMethod public void purchase(PluginCall call){connect(call,()->{
        if(purchaseCall!=null){call.reject("Finish the current purchase first");return;}
        String id=call.getString("productId"),account=call.getString("accountId");ProductDetails product=catalog.get(id);
        if(!allowed.contains(id)||product==null||account==null||!account.matches("[a-f0-9]{64}")){call.reject("Reload the shop before buying");return;}
        BillingFlowParams.ProductDetailsParams.Builder line=BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product);
        String offer=product.getOneTimePurchaseOfferDetails().getOfferToken();if(offer!=null)line.setOfferToken(offer);
        purchaseCall=call;
        BillingResult launched=billing.launchBillingFlow(getActivity(),BillingFlowParams.newBuilder().setObfuscatedAccountId(account).setProductDetailsParamsList(Collections.singletonList(line.build())).build());
        if(launched.getResponseCode()!=BillingClient.BillingResponseCode.OK){purchaseCall=null;call.reject("Google Play could not open this purchase");}
    });}
    @Override public void onPurchasesUpdated(BillingResult result,List<Purchase> rows){
        PluginCall call=purchaseCall;purchaseCall=null;
        if(result.getResponseCode()==BillingClient.BillingResponseCode.USER_CANCELED){if(call!=null){JSObject r=new JSObject();r.put("cancelled",true);call.resolve(r);}return;}
        if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK||rows==null){if(call!=null)call.reject("Purchase unfinished. Use Restore purchases to check it.");return;}
        JSObject answer=new JSObject();answer.put("purchases",purchases(rows));
        if(call!=null)call.resolve(answer);else notifyListeners("purchasesUpdated",answer);
    }
    @PluginMethod public void restore(PluginCall call){connect(call,()->billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),(result,rows)->{
        if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK){call.reject("Could not check purchases");return;}
        JSObject answer=new JSObject();answer.put("purchases",purchases(rows));call.resolve(answer);
    }));}
    @Override protected void handleOnDestroy(){if(billing!=null)billing.endConnection();}
}
