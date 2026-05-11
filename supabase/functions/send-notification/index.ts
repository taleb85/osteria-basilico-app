import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
const TWILIO_FROM = Deno.env.get('TWILIO_FROM_NUMBER') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
  try {
    const { to, subject, text, html, sms, type } = await req.json();
    if (type === 'email' && RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'FLOW <notifications@flow-workinmotion.pages.dev>', to, subject, html: html ?? text }),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.ok ? 200 : 500, headers: { 'Content-Type': 'application/json' } });
    }
    if (type === 'sms' && TWILIO_SID) {
      const payload = new URLSearchParams({ To: to, From: TWILIO_FROM, Body: sms ?? text ?? '' });
      const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: 'POST', headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: payload,
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.ok ? 200 : 500, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: 'No notification channel configured' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
