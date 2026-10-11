import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "npm:stripe@22.6.0";

// Dedicated endpoint: never replaces subscription/public/group webhook handlers.
export async function handleWebhook(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const secret = Deno.env.get("SPONSORSHIP_STRIPE_WEBHOOK_SECRET");
  if (!secret) {
    return new Response("Webhook configuration required", { status: 503 });
  }
  const apiKey = Deno.env.get("SPONSORSHIP_STRIPE_SECRET_KEY");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const databaseUrl = Deno.env.get("SUPABASE_URL");
  if (!apiKey || !key || !databaseUrl) {
    return new Response("Webhook configuration required", { status: 503 });
  }
  let event: Stripe.Event;
  try {
    const stripe = new Stripe(apiKey, {
      apiVersion: "2026-08-26.dahlia",
    });
    event = await stripe.webhooks.constructEventAsync(
      await req.text(),
      req.headers.get("stripe-signature") || "",
      secret,
    );
  } catch {
    return new Response("Invalid event signature", { status: 400 });
  }
  try {
    if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed' ||
        event.type === 'charge.refunded' || event.type === 'charge.dispute.created' || event.type === 'charge.dispute.closed') {
      const object = event.data.object as unknown as { id: string; payment_intent?: string; amount_refunded?: number; metadata?: Record<string,string> };
      const isCheckout = event.type.startsWith('checkout.');
      if (isCheckout && object.metadata?.offerType !== 'private') return new Response('Ignored');
      if (!isCheckout) {
        if (typeof object.payment_intent !== 'string') return new Response('Ignored');
        const intent = await new Stripe(apiKey, { apiVersion: '2026-08-26.dahlia' }).paymentIntents.retrieve(object.payment_intent);
        if (intent.metadata?.offerType !== 'private') return new Response('Ignored');
      }
      const result = await fetch(`${databaseUrl}/rest/v1/rpc/record_sponsorship_payment_event`, {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: event.id, event_type: event.type,
          session_id: isCheckout ? object.id : null,
          payment_intent_id: isCheckout ? null : object.payment_intent,
          refund_cents: event.type === 'charge.refunded' ? object.amount_refunded : null }),
      });
      const recorded = result.ok && await result.json() === true;
      return new Response(recorded ? 'Recorded' : 'Reconciliation required', { status: recorded ? 200 : 500 });
    }
    if (
      ![
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
      ].includes(event.type)
    ) return new Response("Ignored");
    const session = event.data.object as Stripe.Checkout.Session;
    if (
      session.metadata?.offerType !== "private" || !session.metadata?.order_id
    ) return new Response("Ignored");
    if (
      session.payment_status !== "paid" || session.status !== "complete" ||
      session.mode !== "payment"
    ) return new Response("Awaiting payment");
    const result = await fetch(
      `${databaseUrl}/rest/v1/rpc/fund_sponsorship_checkout`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
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
    return new Response(result.ok ? "Confirmed" : "Reconciliation required", {
      status: result.ok ? 200 : 500,
    });
  } catch {
    // A verified payment must be retried after a temporary database/network failure.
    return new Response("Reconciliation required", { status: 500 });
  }
}

if (import.meta.main) serve(handleWebhook);
