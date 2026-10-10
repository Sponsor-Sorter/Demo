import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
if (!STRIPE_SECRET_KEY) throw new Error("Missing STRIPE_SECRET_KEY");
const PRO_PRICE_ID = "price_1SbWeEGpIACU7TxK1H3mXQfR";

const allowedOrigins = new Set([
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "https://sponsorsorter.com",
  "https://www.sponsorsorter.com",
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
    const sessionId = typeof body?.session_id === "string" ? body.session_id : "";
    if (!/^cs_(?:test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
      return reply(400, { error: "Invalid Checkout session" }, origin);
    }

    const stripeResponse = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } },
    );
    if (!stripeResponse.ok) return reply(404, { error: "Checkout session not found" }, origin);

    const session = await stripeResponse.json();
    const subscription = typeof session.subscription === "string" ? session.subscription : null;
    const eligibleSession = session.mode === "subscription"
      && session.status === "complete"
      && session.payment_status !== "unpaid"
      && session.metadata?.offerType === "signup"
      && typeof session.customer === "string"
      && !!subscription;
    if (!eligibleSession) return reply(403, { error: "Session is not a completed Sponsor Sorter Pro signup" }, origin);

    const subscriptionResponse = await fetch(
      `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscription)}`,
      { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } },
    );
    if (!subscriptionResponse.ok) return reply(403, { error: "Subscription is not active" }, origin);
    const stripeSubscription = await subscriptionResponse.json();
    const hasProPrice = (stripeSubscription.items?.data || []).some(
      (item: { price?: { id?: string } }) => item.price?.id === PRO_PRICE_ID,
    );
    if (!hasProPrice || !["active", "trialing"].includes(stripeSubscription.status)) {
      return reply(403, { error: "Subscription is not an active Pro plan" }, origin);
    }

    return reply(200, { customer: session.customer }, origin);
  } catch {
    return reply(400, { error: "Invalid request" }, origin);
  }
});
