// supabase/functions/stripe-checkout/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "npm:stripe@22.6.0";

/* --------------------------- C O R S  ---------------------------------- */
const ALLOWED_ORIGINS = new Set([
  "https://sponsorsorter.com",
  "https://www.sponsorsorter.com",
  "https://sponsor-sorter.github.io",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
]);

function corsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://sponsorsorter.com";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    Vary: "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

/* --------------------------- S T R I P E  ------------------------------- */
const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
if (!stripeSecret) throw new Error("Missing STRIPE_SECRET_KEY");

const stripe = new Stripe(stripeSecret, { apiVersion: "2026-08-26.dahlia" });

/* --------------------------- C O N S T A N T S -------------------------- */
const DEFAULT_LOCAL_BASE = "http://127.0.0.1:5500";   // ✅ no /public
const DEFAULT_PROD_BASE  = "https://sponsorsorter.com";

// LIVE monthly Pro subscription price
const SUBSCRIPTION_PRICE_ID = "price_1SbWeEGpIACU7TxK1H3mXQfR";

/* --------------------------- H E L P E R S ------------------------------ */
function buildUrl(base: string, pathOrFile: string, params = "") {
  if (base.endsWith("/")) base = base.slice(0, -1);
  if (pathOrFile.startsWith("/")) pathOrFile = pathOrFile.slice(1);
  return `${base}/${pathOrFile}${params}`;
}

function ensureSuccessParams(url: string) {
  if (!url.includes("{CHECKOUT_SESSION_ID}")) {
    const sep = url.includes("?") ? "&" : "?";
    url += `${sep}session_id={CHECKOUT_SESSION_ID}&payment_status=success`;
  }
  return url;
}

function isAbsoluteUrl(u?: string): u is string {
  return !!u && /^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(u); // scheme:
}

function asString(v: unknown, fallback = ""): string {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try { return JSON.stringify(v); } catch { return fallback; }
}

function safeMetadataValue(v: unknown, maxLen = 450) {
  const s = asString(v, "");
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/* --------------------------------- API ---------------------------------- */
serve(async (req) => {
  const origin = req.headers.get("origin");
  const CORS = corsHeaders(origin);

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return Response.json({ error: "Origin not allowed" }, { status: 403, headers: CORS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    const {
      // common amount shapes
      amount, amount_cents,

      // legacy context
      offerId, offerType, order_id, subscriptionPriceId, frontendBaseUrl, signupEmail,
      success_path, cancel_path, mode, reason, metadata,

      // ✅ game bounty payload (from gamebounty.html)
      kind,
      creator_handle,
      appid,
      game_name,
      amount_usd,
      min_minutes,
      fan_email,
      note,
      success_url,
      cancel_url,
    } = body || {};

    const isExplicitSubscription = mode === "subscription";
    const isSignup = offerType === "signup" || isExplicitSubscription;

    // ✅ treat either kind=game_bounty OR offerType=game_bounty as a bounty
    const isGameBounty = (kind === "game_bounty") || (offerType === "game_bounty");

    // Auth rules: allow unauthenticated for signup + game bounties
    const authHeader = req.headers.get("authorization");
    if (!isSignup && !isGameBounty && !authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    let authenticatedUserId: string | null = null;
    if (!isSignup && !isGameBounty) {
      const authResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
        headers: { Authorization: authHeader!, apikey: Deno.env.get("SUPABASE_ANON_KEY")! },
      });
      const user = authResponse.ok ? await authResponse.json() : null;
      if (!user?.id || user.is_anonymous === true) {
        return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
      }
      authenticatedUserId = user.id;
    }

    // Base URL for web pages
    let BASE_URL = frontendBaseUrl as string | undefined;
    if (!BASE_URL) {
      const isProd = Deno.env.get("SUPABASE_ENV") === "production";
      BASE_URL = isProd ? DEFAULT_PROD_BASE : DEFAULT_LOCAL_BASE;
    }

    // Success/Cancel URLs:
    // ✅ Priority:
    // 1) success_url/cancel_url (absolute)
    // 2) success_path/cancel_path (relative or absolute)
    // 3) fallback routing by offerType/kind
    let finalSuccessUrl: string;
    let finalCancelUrl: string;

    if (isAbsoluteUrl(success_url) && isAbsoluteUrl(cancel_url)) {
      finalSuccessUrl = ensureSuccessParams(success_url);
      finalCancelUrl = cancel_url;
    } else if (success_path || cancel_path) {
      const rawSuccess = success_path || "payment-success.html";
      const rawCancel  = cancel_path  || "payment-failed.html?payment=cancelled";

      finalSuccessUrl = isAbsoluteUrl(rawSuccess)
        ? ensureSuccessParams(rawSuccess)
        : ensureSuccessParams(buildUrl(BASE_URL!, rawSuccess));

      finalCancelUrl = isAbsoluteUrl(rawCancel)
        ? rawCancel
        : buildUrl(
            BASE_URL!,
            rawCancel.includes("?") ? rawCancel : `${rawCancel}?payment=cancelled`,
          );
    } else {
      if (isGameBounty) {
        // sensible fallback (usually you pass success_url/cancel_url from the page)
        const h = encodeURIComponent(asString(creator_handle, "creator").replace(/^@/, ""));
        const a = encodeURIComponent(asString(appid, ""));
        finalSuccessUrl = ensureSuccessParams(buildUrl(BASE_URL!, `gamebounty.html?handle=${h}&success=1&appid=${a}`));
        finalCancelUrl = buildUrl(BASE_URL!, `gamebounty.html?handle=${h}&cancelled=1&appid=${a}`);
      } else if (offerType === "public") {
        finalSuccessUrl = ensureSuccessParams(buildUrl(BASE_URL!, "payment-success-public.html"));
        finalCancelUrl  = buildUrl(BASE_URL!, "publicOffers.html?payment=cancelled");
      } else if (offerType === "group") {
        finalSuccessUrl = ensureSuccessParams(buildUrl(BASE_URL!, "payment-success-group.html"));
        finalCancelUrl  = buildUrl(BASE_URL!, "payment-failed.html?reason=cancelled");
      } else if (isSignup) {
        finalSuccessUrl = ensureSuccessParams(buildUrl(BASE_URL!, "payment-success-signup.html"));
        finalCancelUrl  = buildUrl(BASE_URL!, "signup.html?payment=cancelled");
      } else {
        finalSuccessUrl = ensureSuccessParams(buildUrl(BASE_URL!, "payment-success.html"));
        finalCancelUrl  = buildUrl(BASE_URL!, "newoffer.html?payment=cancelled");
      }
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      integration_identifier: 'sponsorsorter_abcdefgh',
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      allow_promotion_codes: true,
      metadata: {
        ...(metadata || {}),
        ...(offerId ? { offerId: asString(offerId) } : {}),
        ...(offerType ? { offerType: asString(offerType) } : {}),
        ...(reason ? { reason: asString(reason) } : {}),
        ...(kind ? { kind: asString(kind) } : {}),
      },
    };

    // -------------------------
    // Subscription (signup/pro)
    // -------------------------
    if (isSignup) {
      const normalizedSignupEmail = asString(signupEmail, "").trim().toLowerCase();
      if (!isValidEmail(normalizedSignupEmail)) {
        return new Response(JSON.stringify({ error: "A valid signup email is required." }), {
          status: 400,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      if (subscriptionPriceId && subscriptionPriceId !== SUBSCRIPTION_PRICE_ID) {
        return new Response(JSON.stringify({ error: "Unsupported subscription plan." }), {
          status: 400,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      const allowedSignupBases = new Set([
        "https://sponsorsorter.com",
        "https://www.sponsorsorter.com",
        "https://sponsor-sorter.github.io/Demo",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
      ]);
      if (!allowedSignupBases.has(BASE_URL!)) {
        return new Response(JSON.stringify({ error: "Signup return URL is not allowed." }), {
          status: 400,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      finalSuccessUrl = ensureSuccessParams(buildUrl(BASE_URL!, "payment-success-signup.html"));
      finalCancelUrl = buildUrl(BASE_URL!, "signup.html?payment=cancelled");
      // Override caller-supplied destinations on the actual Stripe request.
      sessionParams.success_url = finalSuccessUrl;
      sessionParams.cancel_url = finalCancelUrl;
      sessionParams.customer_email = normalizedSignupEmail;
      sessionParams.metadata = {
        ...(sessionParams.metadata || {}),
        offerType: "signup",
        signup_email: normalizedSignupEmail,
      };
      sessionParams.subscription_data = {
        metadata: { offerType: "signup", signup_email: normalizedSignupEmail },
      };
      sessionParams.mode = "subscription";
      sessionParams.line_items = [{
        price: subscriptionPriceId || SUBSCRIPTION_PRICE_ID,
        quantity: 1,
      }];

      const session = await stripe.checkout.sessions.create(sessionParams);
      return new Response(JSON.stringify({
        sessionId: session.id,
        checkoutUrl: session.url,
        sessionUrl: session.url,
        url: session.url,
      }), {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // -------------------------
    // One-time payments
    // -------------------------
    // CORS alone cannot prevent a caller from supplying a phishing return URL.
    for (const destination of [finalSuccessUrl, finalCancelUrl]) {
      let allowed = false;
      try { allowed = ALLOWED_ORIGINS.has(new URL(destination).origin); } catch { /* reject malformed URLs */ }
      if (!allowed) return Response.json({ error: "Return URL is not allowed" }, { status: 400, headers: CORS });
    }
    // ✅ compute cents from multiple possible inputs
    let cents: number;

    if (typeof amount_cents === "number" && Number.isFinite(amount_cents)) {
      cents = Math.round(amount_cents);
    } else if (typeof amount_usd === "number" && Number.isFinite(amount_usd)) {
      cents = Math.round(amount_usd * 100);
    } else {
      cents = Math.round(Number(amount) * 100);
    }

    let privateOrder: { id: string; total_cents: number; sponsor_user_id: string } | null = null;
    if (offerType === 'private' || offerType === 'group') {
      if (typeof order_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(order_id)) {
        return Response.json({ error: 'A saved sponsorship order is required.' }, { status: 400, headers: CORS });
      }
      const result = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/sponsorship_orders?id=eq.${order_id}&select=id,total_cents,sponsor_user_id,source,status,stripe_session_id,checkout_expired,offer_kind`, {
        headers: { Authorization: authHeader!, apikey: Deno.env.get('SUPABASE_ANON_KEY')! },
      });
      const orders = result.ok ? await result.json() : [];
      const order = orders[0];
      if (!order || order.sponsor_user_id !== authenticatedUserId || order.source !== 'stripe' || order.offer_kind !== offerType || order.status !== 'pending') {
        return Response.json({ error: 'Purchase is unavailable for checkout.' }, { status: 409, headers: CORS });
      }
      privateOrder = order;
      if (order.checkout_expired) return Response.json({ error: 'Checkout expired. Please start a new proposal.', code: 'CHECKOUT_EXPIRED' }, { status: 409, headers: CORS });
      const privateKey = Deno.env.get('SPONSORSHIP_STRIPE_SECRET_KEY');
      if (!privateKey) return Response.json({ error: 'Sponsorship checkout is not configured.' }, { status: 503, headers: CORS });
      if (order.stripe_session_id) {
        const existing = await new Stripe(privateKey, { apiVersion: '2026-08-26.dahlia' }).checkout.sessions.retrieve(order.stripe_session_id);
        if (existing.status === 'expired') return Response.json({ error: 'Checkout expired. Please start a new proposal.', code: 'CHECKOUT_EXPIRED' }, { status: 409, headers: CORS });
        if (existing.status === 'complete') return Response.json({ error: 'Payment is being reconciled. Open your checkout receipt; do not pay again.', code: 'CHECKOUT_COMPLETE', sessionId: existing.id }, { status: 409, headers: CORS });
        if (existing.status === 'open' && existing.url) return Response.json({ sessionId: existing.id, checkoutUrl: existing.url, orderId: order.id, totalCents: order.total_cents, livemode: existing.livemode }, { headers: CORS });
      }
      cents = Number(order.total_cents);
      sessionParams.allow_promotion_codes = false;
      sessionParams.adaptive_pricing = { enabled: false };
      sessionParams.metadata = { offerType, order_id: order.id, sponsor_user_id: authenticatedUserId! };
      sessionParams.payment_intent_data = { metadata: { offerType, order_id: order.id } };
      // Stable destinations also keep retries compatible with Stripe idempotency.
      sessionParams.success_url = 'https://sponsorsorter.com/payment-success.html?session_id={CHECKOUT_SESSION_ID}';
      sessionParams.cancel_url = 'https://sponsorsorter.com/newoffer.html?payment=cancelled';
    }
    if (!Number.isSafeInteger(cents) || cents < 1 || cents > 99999999) {
      return new Response(JSON.stringify({ error: "Invalid amount." }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    sessionParams.mode = "payment";

    // ✅ Game bounty line item + metadata + customer_email
    if (isGameBounty) {
      const handle = asString(creator_handle, "creator").replace(/^@/, "");
      const app = asString(appid, "");
      const gname = asString(game_name, "Steam Game");

      // Customer email for receipt/refunds (optional but recommended)
      const email = asString(fan_email, "").trim();
      if (email && isValidEmail(email)) {
        sessionParams.customer_email = email;
      }

      // Add bounty-specific metadata (stringified + safe length)
      sessionParams.metadata = {
        ...(sessionParams.metadata || {}),
        creator_handle: safeMetadataValue(handle),
        appid: safeMetadataValue(app),
        game_name: safeMetadataValue(gname),
        min_minutes: safeMetadataValue(min_minutes),
        fan_email: safeMetadataValue(email),
        note: safeMetadataValue(note),
      };

      sessionParams.line_items = [{
        price_data: {
          currency: "usd",
          product_data: {
            name: "Game Bounty",
            description: `${gname} for @${handle}${app ? ` (AppID: ${app})` : ""}`,
          },
          unit_amount: cents,
        },
        quantity: 1,
      }];
    } else {
      // default legacy one-time offer payment
      sessionParams.line_items = [{
        price_data: {
          currency: "usd",
          product_data: {
            name:
              offerType === "group" ? "Sponsorship Offer Payment (Group)"
              : offerType === "signup" ? "Signup Fee"
              : "Sponsorship Offer Payment",
            description: privateOrder ? `Order: ${privateOrder.id}` : offerId ? `Ref: ${offerId}` : undefined,
          },
          unit_amount: cents,
        },
        quantity: 1,
      }];
    }

    const checkoutStripe = privateOrder ? new Stripe(Deno.env.get('SPONSORSHIP_STRIPE_SECRET_KEY')!, { apiVersion: '2026-08-26.dahlia' }) : stripe;
    const session = await checkoutStripe.checkout.sessions.create(sessionParams,
      privateOrder ? { idempotencyKey: `sponsorship-${privateOrder.id}` } : undefined);
    if (privateOrder) {
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const bound = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/bind_sponsorship_checkout`, {
        method: 'POST', headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: privateOrder.id, session_id: session.id }),
      });
      if (!bound.ok) throw new Error('Purchase binding failed');
    }

    return new Response(JSON.stringify({
      sessionId: session.id,
      checkoutUrl: session.url,
      sessionUrl: session.url,
      url: session.url,
      ...(privateOrder ? { orderId: privateOrder.id, totalCents: privateOrder.total_cents, livemode: session.livemode } : {}),
    }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch {
    return new Response(JSON.stringify({ error: "Checkout could not be created. Please try again." }), {
      status: 500,
      headers: {
        ...corsHeaders(req.headers.get("origin")),
        "Content-Type": "application/json",
      },
    });
  }
});

