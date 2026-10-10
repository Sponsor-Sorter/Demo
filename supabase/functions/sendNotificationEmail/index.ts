// Sends a stored, unexpired 2FA code to the authenticated user's own email.
// Do not turn this back into a general-purpose mail relay.
import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@4.8.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const resendApiKey = Deno.env.get("RESEND_API_KEY");
if (!supabaseUrl || !anonKey || !serviceRoleKey || !resendApiKey) {
  throw new Error("Missing required email function configuration");
}

const resend = new Resend(resendApiKey);
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: "Authentication required" }, 401);

  // Validate the presented JWT with Auth; never trust user IDs or email from the body.
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await caller.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user?.id || !user.email || user.is_anonymous) {
    return json({ error: "Valid signed-in account required" }, 401);
  }

  let body: { to?: unknown; code?: unknown; context?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const recipient = typeof body.to === "string" ? body.to.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const context = body.context === "setup" ? "setup" : "login";
  if (!recipient || recipient.toLowerCase() !== user.email.toLowerCase() || !/^\d{6}$/.test(code)) {
    return json({ error: "Invalid verification request" }, 400);
  }

  // Only send a code that the app has already stored for this exact account and that is live.
  const { data: profile, error: profileError } = await admin
    .from("users_extended_data")
    .select("email, twofa_email_code, twofa_email_expires_at")
    .eq("user_id", user.id)
    .maybeSingle();
  const expiry = profile?.twofa_email_expires_at
    ? Date.parse(profile.twofa_email_expires_at)
    : NaN;
  if (
    profileError || !profile || profile.email?.toLowerCase() !== user.email.toLowerCase() ||
    String(profile.twofa_email_code ?? "") !== code || !Number.isFinite(expiry) || expiry <= Date.now()
  ) {
    return json({ error: "Verification code is invalid or expired" }, 403);
  }

  const subject = context === "setup"
    ? "Two-factor authentication setup code"
    : "Your Sponsor Sorter login code";
  const text = `Your Sponsor Sorter verification code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`;
  try {
    const { error: sendError } = await resend.emails.send({
      from: "Sponsor Sorter <no-reply@sponsorsorter.com>",
      to: [user.email],
      subject,
      text,
    });
    if (sendError) throw sendError;
    return json({ success: true });
  } catch (error) {
    console.error("2FA email delivery failed", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Unable to send verification email" }, 502);
  }
});
