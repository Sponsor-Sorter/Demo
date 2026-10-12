import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const origins = new Set([
  "https://sponsorsorter.com",
  "https://www.sponsorsorter.com",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
]);
serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = {
    "Access-Control-Allow-Origin": origin && origins.has(origin)
      ? origin
      : "https://sponsorsorter.com",
    Vary: "Origin",
    "Access-Control-Allow-Headers":
      "authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
  const reply = (body: unknown, status = 200) =>
    Response.json(body, { status, headers });
  if (origin && !origins.has(origin)) {
    return reply({ error: "Origin not allowed" }, 403);
  }
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const authorization = req.headers.get("authorization");
    if (!authorization) return reply({ error: "Sign in required" }, 401);
    const base = Deno.env.get("SUPABASE_URL")!;
    const userResponse = await fetch(`${base}/auth/v1/user`, {
      headers: {
        Authorization: authorization,
        apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
      },
    });
    const user = userResponse.ok ? await userResponse.json() : null;
    if (!user?.id || user.is_anonymous) {
      return reply({ error: "Sign in required" }, 401);
    }
    const { session_id } = await req.json();
    if (
      typeof session_id !== "string" ||
      !/^cs_(test|live)_[A-Za-z0-9]+$/.test(session_id)
    ) return reply({ error: "Invalid checkout reference" }, 400);
    const paymentResponse = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${session_id}`,
      {
        headers: {
          Authorization: `Bearer ${Deno.env.get("SPONSORSHIP_STRIPE_SECRET_KEY")}`,
        },
      },
    );
    if (!paymentResponse.ok) {
      return reply({ error: "Checkout could not be verified" }, 409);
    }
    const session = await paymentResponse.json();
    if (
      session.metadata?.sponsor_user_id !== user.id ||
      !["private", "group"].includes(session.metadata?.offerType)
    ) return reply({ error: "Checkout does not belong to this account" }, 403);
    if (
      session.mode !== "payment" || session.status !== "complete" ||
      session.payment_status !== "paid"
    ) {
      return reply({
        error: "Payment is not confirmed yet. Return here after it completes.",
      }, 409);
    }
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const fulfilled = await fetch(
      `${base}/rest/v1/rpc/fund_sponsorship_checkout`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_id: session.metadata.order_id,
          session_id: session.id,
          payment_intent_id: session.payment_intent,
          paid_cents: session.amount_total,
          paid_currency: session.currency,
        }),
      },
    );
    if (!fulfilled.ok) {
      return reply({
        error:
          "Payment needs reconciliation. Keep your receipt and contact support; do not pay again.",
      }, 409);
    }
    return reply({ offer_id: await fulfilled.json() });
  } catch {
    return reply({
      error: "Payment could not be verified. Keep your receipt and try again.",
    }, 500);
  }
});
