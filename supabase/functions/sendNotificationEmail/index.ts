// /supabase/functions/sendNotificationEmail/index.ts

import { serve } from 'https://deno.land/std@0.181.0/http/server.ts'
import { Resend } from "npm:resend"

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

serve(async (req) => {
  // Expect: { to, subject, html }
  const { to, subject, html } = await req.json()
  if (!to || !subject || !html) {
    return new Response(JSON.stringify({ error: 'Missing params' }), { status: 400 })
  }

  try {
    await resend.emails.send({
      from: 'Sponsor Sorter <no-reply@sponsorsorter.com>',
      to,
      subject,
      html,
    })
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
