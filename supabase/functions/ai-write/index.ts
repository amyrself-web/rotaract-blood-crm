// AI writing for the CRM, with Google Gemini.
// Turns a short instruction or a voice note (Tamil or English) into a ready WhatsApp message, notice or post text.
// Needs the secret GEMINI_API_KEY (free key from https://aistudio.google.com/apikey). Optional GEMINI_MODEL.
// Only signed-in team members (Messages, Members or Meetings permission) can use it. Nothing is stored.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const KIND: Record<string, string> = {
  whatsapp: 'a WhatsApp message the club sends to blood donors or members. Under 600 characters. Start with "Hello {name}," when it is for a person (the app fills {name} in for each person). End with "- {club}".',
  notice: 'a notice for the club notice board: a short title on the first line, then the notice. Under 800 characters.',
  post: 'a short caption for a WhatsApp status / Instagram post. Under 300 characters, 1 to 3 fitting emojis, no hashtags spam (at most 3).',
  free: 'the text the club member asks for. Keep it short and clear.',
}
const LANG: Record<string, string> = {
  ta: 'Write it in Tamil (தமிழ் script), simple everyday Tamil that anyone in Tamil Nadu reads easily. Keep blood groups, numbers, phone numbers and place names as they are.',
  en: 'Write it in simple Indian English.',
  both: 'Write it in Tamil first, then the same message in simple English below it, separated by one blank line.',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'Use POST' }, 405)
  try {
    const key = Deno.env.get('GEMINI_API_KEY') ?? ''
    const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash'
    const auth = req.headers.get('Authorization') ?? ''
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
    const { data: { user } } = await sb.auth.getUser(auth.replace(/^Bearer\s+/i, ''))
    if (!user) return reply({ error: 'Sign in again' }, 401)
    const ok = (await Promise.all(['messages', 'members', 'meetings'].map((m) => sb.rpc('perm', { m })))).some((r) => r.data === true)
    if (!ok) return reply({ error: 'Your login cannot use AI writing' }, 403)

    const body = await req.json().catch(() => ({}))
    if (body.action === 'status') return reply({ configured: !!key, model })
    if (!key) return reply({ error: 'AI is not set up yet. Add the GEMINI_API_KEY secret in Supabase.', configured: false }, 400)

    const instruction = String(body.instruction ?? '').slice(0, 2000)
    const current = String(body.current ?? '').slice(0, 2000)
    const audio = body.audio && typeof body.audio.data === 'string' ? body.audio : null
    if (!instruction.trim() && !audio) return reply({ error: 'Say or type what the message should be about' }, 400)
    if (audio && audio.data.length > 11_000_000) return reply({ error: 'The voice note is too long. Keep it under 3 minutes.' }, 400)

    const prompt = [
      `You help ${String(body.club || 'a Rotaract club').slice(0, 120)}, a Rotaract club in Tamil Nadu, India, that runs blood donation camps, eye donation and community service.`,
      `Write ${KIND[body.kind] ?? KIND.free}`,
      LANG[body.lang] ?? LANG.en,
      'Use only the facts given (dates, places, numbers, names). Never invent a date, time, place, phone number or blood group. If something important is missing, leave a clear blank like ____ instead of guessing.',
      'Warm, respectful and clear. No markdown, no quotes around the message, no explanations: reply with the message text only.',
      audio ? 'A club member recorded the voice note attached (Tamil, English or Tanglish). Work out what they want and write it.' : '',
      instruction ? `What the club member asked for: ${instruction}` : '',
      current ? `The message box already has this draft; improve or replace it as asked:\n${current}` : '',
    ].filter(Boolean).join('\n\n')

    const parts: unknown[] = [{ text: prompt }]
    if (audio) parts.push({ inline_data: { mime_type: String(audio.mime || 'audio/wav'), data: audio.data } })
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.6, maxOutputTokens: 1200 } }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      const msg = j?.error?.message ?? `AI service error ${r.status}`
      return reply({ error: /API key/i.test(msg) ? 'The Gemini key is not valid. Check GEMINI_API_KEY.' : /quota|rate/i.test(msg) ? 'The free AI limit is used up for now. Try again in a minute.' : msg }, 502)
    }
    const text = (j?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('').trim()
    if (!text) return reply({ error: 'The AI gave no answer. Try saying it differently.' }, 502)
    return reply({ text: text.replace(/^["“]|["”]$/g, '').trim() })
  } catch (e) {
    return reply({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
