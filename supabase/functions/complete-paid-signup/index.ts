import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const PRO_PRICE_ID = "price_1SbWeEGpIACU7TxK1H3mXQfR";
if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing required server configuration");
}

const allowedOrigins = new Set([
  "http://127.0.0.1:5500", "http://localhost:5500",
  "https://sponsorsorter.com", "https://www.sponsorsorter.com",
  "https://sponsor-sorter.github.io",
]);

function headers(origin: string | null): HeadersInit {
  const result: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
  if (origin && allowedOrigins.has(origin)) result["Access-Control-Allow-Origin"] = origin;
  return result;
}
function reply(status: number, body: Record<string, unknown>, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin) });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" }, origin);
  if (origin && !allowedOrigins.has(origin)) return reply(403, { error: "Origin not allowed" }, origin);

  try {
    const body = await req.json();
    const userId = typeof body?.user_id === "string" ? body.user_id : "";
    const sessionId = typeof body?.session_id === "string" ? body.session_id : "";
    const profile = body?.profile;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
      || !/^cs_(?:test|live)_[A-Za-z0-9]+$/.test(sessionId)
      || !profile || typeof profile !== "object" || typeof profile.email !== "string") {
      return reply(400, { error: "Invalid signup details" }, origin);
    }

    const stripeHeaders = { Authorization: `Bearer ${STRIPE_SECRET_KEY}` };
    const sessionResponse = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { headers: stripeHeaders },
    );
    if (!sessionResponse.ok) return reply(403, { error: "Checkout session could not be verified" }, origin);
    const session = await sessionResponse.json();
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : "";
    const customerId = typeof session.customer === "string" ? session.customer : "";
    const sessionEmail = String(session.metadata?.signup_email || "").trim().toLowerCase();
    if (session.mode !== "subscription" || session.status !== "complete"
      || !["paid", "no_payment_required"].includes(session.payment_status) || session.metadata?.offerType !== "signup"
      || !subscriptionId || !/^cus_[A-Za-z0-9]+$/.test(customerId)
      || !sessionEmail || sessionEmail !== profile.email.trim().toLowerCase()) {
      return reply(403, { error: "Checkout does not match a completed Pro signup" }, origin);
    }

    const subscriptionResponse = await fetch(
      `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
      { headers: stripeHeaders },
    );
    if (!subscriptionResponse.ok) return reply(403, { error: "Subscription could not be verified" }, origin);
    const subscription = await subscriptionResponse.json();
    const hasProPrice = (subscription.items?.data || []).some(
      (item: { price?: { id?: string } }) => item.price?.id === PRO_PRICE_ID,
    );
    if (subscription.customer !== customerId || !hasProPrice
      || !["active", "trialing"].includes(subscription.status)) {
      return reply(403, { error: "Subscription is not an active Pro plan" }, origin);
    }

    const authResponse = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
      { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
    );
    if (!authResponse.ok) return reply(403, { error: "Signup account could not be verified" }, origin);
    const authUser = await authResponse.json();
    if (String(authUser.email || "").trim().toLowerCase() !== sessionEmail) {
      return reply(403, { error: "Checkout email does not match the signup account" }, origin);
    }

    const rpcResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/register_paid_profile`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_email: sessionEmail,
        p_profile: profile,
        p_customer_id: customerId,
        p_subscription_id: subscriptionId,
        p_price_id: PRO_PRICE_ID,
      }),
    });
    if (!rpcResponse.ok) return reply(500, { error: "Could not finish paid signup" }, origin);
    return reply(200, { success: true, plan: "pro" }, origin);
  } catch {
    return reply(400, { error: "Invalid signup request" }, origin);
  }
});
