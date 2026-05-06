// Edge Function per hashing PIN lato server
// Usata dal client per hashare il PIN prima di salvarlo nel DB
// 
// Endpoint: POST /functions/v1/pin-hash
// Body: { pin: string }
// Response: { hash: string }
//
// NOTA: In produzione, usare un sale per-utente (es. user_id + secret)
// per mitigare attacchi rainbow table.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const encoder = new TextEncoder()

async function hashPin(pin: string): Promise<string> {
  const data = encoder.encode(pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  // Solo POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { pin } = await req.json()

    if (!pin || typeof pin !== 'string') {
      return new Response(
        JSON.stringify({ error: 'PIN mancante o non valido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!/^\d{4,8}$/.test(pin)) {
      return new Response(
        JSON.stringify({ error: 'PIN deve essere numerico (4-8 cifre)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const hash = await hashPin(pin)

    return new Response(
      JSON.stringify({ hash }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
